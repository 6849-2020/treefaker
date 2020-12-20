/**
 * An augmented Lagrangian-based solver for disk packing.
 * Ported nearly verbatim from Robert J. Lang's TreeMaker v5.
 * (TODO: any necessary licensing notes before public release.)
 */
import {
  matrix,
  zeros,
  ones,
  size,
  norm,
  dot,
  abs,
  min,
  max,
  multiply,
  dotDivide,
  add,
  diag,
  subtract,
  clone,
  index,
  subset,
  range,
  flatten
} from "mathjs";
import { Constraint, ConstraintSet } from "./constraints";

type Step = {
  X: matrix;
  f: number;
  grad: matrix;
};

/* Optimization hyperparameters. */
// Outer search parameters (Augmented Lagrangian coefficients).
const WEIGHT_START = 10;
const WEIGHT_RATIO = 10;
const WEIGHT_MAX = 1e8;
const ITERS_OUTER = 50;

// Inner search parameters
const ITERS_INNER = 100;
// How much (relatively) does the objective value need to decrease
// to terminate an instance of line search?
const ALF = 1e-4;

// Convergence tolerances.
const EPS = Number.EPSILON;
const X_TOL = 4 * EPS;
const G_TOL = 1e-5;

function maxStepSize(X: matrix): number {
  // We assume that each of the `n` points has an associated
  // eslint-disable-next-line no-irregular-whitespace
  // upper and lower bound such that 0 ≤ x_i, y_i ≤ 1.
  // Following Lang, we choose the maximum step size to be the length
  // of a diagonal in the 2n-dimensional hypercube [0, 1] x ... [0 x 1].
  const n = (size(X) - 1) / 2;
  return Math.sqrt(2 * n);
}

function augLag(
  X: matrix,
  constraints: ConstraintSet,
  mult: matrix,
  weight: number
): number {
  const n = (size(X) - 1) / 2;
  let total = -X[2 * n]; // objective: maximize scale factor
  // We assume that all constraints are inequality constraints.
  for (const [i, fn] of constraints.constraints.entries()) {
    const lm = mult[i];
    const val = fn(X);
    const mu = (-0.5 * lm) / weight;
    total += val < mu ? mu : (lm + val * weight) * val;
  }
  return total;
}

function gradAugLag(
  X: matrix,
  constraints: ConstraintSet,
  mult: matrix,
  weight: number
): matrix {
  const n = (size(X) - 1) / 2;
  let grad = zeros([2 * n + 1]);
  grad[2 * n] = -1; // gradient of objective (maximize scale factor)
  for (const [i, fn] of constraints.constraints.entries()) {
    const lm = mult[i];
    const val = fn(X);
    const mu = (-0.5 * lm) / weight;
    if (val >= mu) {
      const gradMul = lm + 2 * val * weight;
      if (Math.abs(gradMul) > X_TOL) {
        const gradFn = constraints.grad[i];
        const gradVal = gradFn(X);
        grad = add(grad, multiply(gradMul, gradVal));
      }
    }
  }
  return grad;
}

function updateMultipliers(
  X: matrix,
  constraints: ConstraintSet,
  oldMult: matrix,
  weight: number
): matrix {
  const newMult = clone(oldMult);
  for (const [i, fn] of constraints.constraints.entries()) {
    const f = fn(X);
    const mu = (-0.5 * oldMult[i]) / weight;
    if (f < mu) {
      newMult[i] = 0;
    } else {
      newMult[i] += 2 * weight * f;
    }
  }
  return newMult;
}

function outer(v1: matrix, v2: matrix): matrix | undefined {
  /* Computes the outer product of two vectors. */
  if (size(v1).length !== 1 || size(v2).length !== 1) {
    // Operation only defined on vectors.
    return undefined;
  }
  const s1 = size(v1)[0];
  const s2 = size(v2)[0];
  const res = ones([s1, s2]);
  for (let i = 0; i < s1; i++) {
    for (let j = 0; j < s2; j++) {
      res[i][j] = v1[i] * v2[j];
    }
  }
  return res;
}

export function rescaleSol(X: matrix, dists: matrix): matrix {
  /**
   * Coerce a solution to be valid by scaling points to [0, 1] x [0, 1]
   * and computing the optimal scale factor.
   */
  const n = (size(X)[0] - 1) / 2;
  let xCoords = subset(X, index(range(0, n)));
  let yCoords = subset(X, index(range(n, 2 * n)));

  const xMin = min(xCoords);
  const yMin = min(yCoords);
  xCoords = subtract(xCoords, xMin);
  yCoords = subtract(yCoords, yMin);

  const scale = 1 / max(max(xCoords), max(yCoords));
  xCoords = multiply(scale, xCoords);
  yCoords = multiply(scale, yCoords);
  const packingDists = zeros([n, n]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.sqrt(
        Math.pow(xCoords[i] - xCoords[j], 2) +
          Math.pow(yCoords[i] - yCoords[j], 2)
      );
      packingDists[i][j] = dist;
      packingDists[j][i] = dist;
    }
  }
  const ratio =
    min(
      flatten(dotDivide(packingDists, dists)).filter((x: number) => !isNaN(x))
    ) / 2;
  return [...xCoords, ...yCoords, ratio];
}

function lineSearch(
  old: Step,
  searchDirection: matrix,
  constraints: ConstraintSet,
  mult: matrix,
  weight: number
): Step | undefined {
  //console.log("\t--- minimizing along line ---");
  const searchNorm = norm(searchDirection);
  let scale = 1;
  const maxStep = maxStepSize(old.X);
  if (searchNorm > maxStep) {
    scale = maxStep / searchNorm;
  }

  // Stop if going uphill.
  const slope = dot(old.grad, multiply(scale, searchDirection));
  if (slope >= 0) {
    return old;
  }

  const minStep =
    EPS /
    max(
      dotDivide(
        abs(searchDirection),
        max([abs(old.X), ones([size(old.X)[0]])], 0)
      ),
      0
    );
  /*
  console.log("\tsearch direction:", searchDirection);
  console.log("\tscale:", scale);
  console.log("\tinitial slope:", slope);
  console.log("\tminimum step size", minStep);
  */

  let lm = 1.0; // step size relative to a full Newton step.
  let lastLm = 0.0; // last step size
  let lastF = 0.0; // last augmented Lagrangian function value
  let lastX = old.X;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Take a step along the search direction.
    const XNew = add(old.X, multiply(scale * lm, searchDirection));
    const fNew = augLag(XNew, constraints, mult, weight);
    /*
    console.log("lm:", lm);
    console.log("\t\tX:", XNew);
    console.log("\t\tf:", fNew);
    */

    const fTarget = lastF + ALF * lm * slope;
    if (lm < minStep) {
      // Quit once the step size is below the minimum tolerance.
      // Use the last iteration (known good).
      break;
    } else if (fNew <= fTarget) {
      // We've made sufficient progress in this iteration; terminate.
      return {
        X: XNew,
        f: fNew,
        grad: gradAugLag(XNew, constraints, mult, weight)
      };
    } else {
      // The hard part: do a backtracking step.
      let nextLm: number | undefined = undefined;
      if (lm === 1.0) {
        nextLm = -slope / (2 * (fNew - old.f - slope));
      } else {
        const rhs1 = fNew - old.f - lm * slope;
        const rhs2 = lastF - old.f - lastLm * slope;
        const lmSq = Math.pow(lm, 2);
        const lastLmSq = Math.pow(lastLm, 2);
        const lmDelta = lm - lastLm;
        const a = (rhs1 / lmSq - rhs2 / lastLmSq) / lmDelta;
        const b = ((-lastLm * rhs1) / lmSq + (lm * rhs2) / lastLmSq) / lmDelta;
        if (a === 0) {
          nextLm = -slope / (2 * b);
        } else {
          const discr = Math.pow(b, 2) - 3 * a * slope;
          if (discr < 0) {
            nextLm = lm / 2;
          } else if (b <= 0.0) {
            nextLm = (-b + Math.sqrt(discr)) / (3 * a);
          } else {
            nextLm = -slope / (b + Math.sqrt(discr));
          }
          nextLm = Math.min(nextLm, lm / 2);
        }
      }
      lastLm = lm;
      lastF = fNew;
      lastX = XNew;
      lm = Math.max(nextLm, lm / 10);
    }
  }
  return {
    X: lastX,
    f: lastF,
    grad: gradAugLag(lastX, constraints, mult, weight)
  };
}

function minimizeAugLag(
  last: Step,
  constraints: ConstraintSet,
  mult: matrix,
  weight: number
): Step | undefined {
  let lastStep = last;
  let searchDirection = multiply(
    -1,
    gradAugLag(last.X, constraints, mult, weight)
  );
  let hessInv = diag(ones([size(last.grad)[0]]));
  for (let iter = 1; iter <= ITERS_INNER; iter++) {
    //console.log("\t--- inner iteration", iter, "---");
    const nextStep = lineSearch(
      lastStep,
      searchDirection,
      constraints,
      mult,
      weight
    );
    //console.log("\t", nextStep);
    if (nextStep === undefined) {
      // Something went wrong in the inner optimization step.
      // Propagate the error upward.
      return undefined;
    }
    searchDirection = subtract(nextStep.X, lastStep.X);

    // Test for convergence of step size.
    const xTest = max(
      dotDivide(
        abs(searchDirection),
        max([abs(nextStep.X), ones([size(nextStep.X)[0]])], 0)
      )
    );
    if (xTest < X_TOL) {
      break;
    }

    // Test for convergence to zero gradient.
    const gTest =
      max(
        multiply(
          abs(nextStep.grad),
          max([abs(nextStep.X), ones([size(nextStep.X)[0]])], 0)
        )
      ) / Math.max(nextStep.f, 1);
    if (gTest < G_TOL) {
      break;
    }

    // Compute dot products used in Hessian update denominators.
    const gradDelta = subtract(nextStep.grad, lastStep.grad);
    const hdg = multiply(hessInv, gradDelta);
    const fac = dot(gradDelta, searchDirection);
    const fae = dot(gradDelta, hdg);
    const sumDg = Math.pow(norm(gradDelta), 2);
    const sumXi = Math.pow(norm(searchDirection), 2);

    // Update the inverse Hessian.
    /*
    console.log("fac:", fac);
    console.log("fae:", fae);
    console.log("sumDg:", sumDg);
    console.log("sumXi:", sumXi);
    */

    if (fac > Math.sqrt(EPS * sumDg * sumXi)) {
      const facInv = 1.0 / fac;
      const fad = 1.0 / fae;
      const dg = subtract(
        multiply(facInv, searchDirection),
        multiply(fad, hdg)
      );
      const hessInvDelta = subtract(
        add(
          multiply(facInv, outer(searchDirection, searchDirection)),
          multiply(fae, outer(dg, dg))
        ),
        multiply(fad, outer(hdg, hdg))
      );
      hessInv = add(hessInv, hessInvDelta);
      //console.log("\tinverse Hessian delta:", hessInvDelta);
    }
    //console.log("\tinverse Hessian:", hessInv);
    //console.log("\tgradient:", nextStep.grad);
    searchDirection = multiply(hessInv, multiply(-1, nextStep.grad));
    lastStep = nextStep;
  }
  return lastStep;
}

export function solve(
  X: matrix,
  dists: matrix,
  constraints: ConstraintSet
): matrix | undefined {
  const nConstraints = constraints.constraints.length;
  let mult = zeros([nConstraints]);
  let weight = WEIGHT_START;
  //const scaledX = rescaleSol(X, dists);
  let lastStep = {
    X: X,
    f: augLag(X, constraints, mult, weight),
    grad: gradAugLag(X, constraints, mult, weight)
  };
  let bestObjVal: number | undefined = 0;
  let bestSol: matrix | undefined = undefined;

  for (let iter = 0; iter < ITERS_OUTER; iter++) {
    //console.log("--- outer iteration", iter, "---");
    const unscaledNextStep = minimizeAugLag(
      lastStep,
      constraints,
      mult,
      weight
    );
    //console.log("unscaled:", unscaledNextStep);
    if (unscaledNextStep === undefined) {
      // Something went wrong in the inner optimization step. :(
      return undefined;
    }
    const nextStep = unscaledNextStep; /*{
      X: X,
      f: augLag(X, constraints, mult, weight),
      grad: gradAugLag(X, constraints, mult, weight),
    };*/
    //console.log("scaled:", nextStep);
    const feasibility = max(
      max(constraints.constraints.map((con: Constraint) => con(nextStep.X))),
      0
    );
    mult = updateMultipliers(nextStep.X, constraints, mult, weight);

    // TODO (@pjrule): allow for arbitrary objective functions.
    // (For our first version, we are primarily concerned with
    //  maximizing the scale factor.)
    const nextObjVal = -nextStep.X[size(nextStep.X)[0] - 1];
    //console.log("\tfeasibility:", feasibility);
    //console.log("\tobj:", nextObjVal);

    if (iter > 0 && feasibility < G_TOL && bestObjVal > nextObjVal) {
      // Terminate if the solution is feasible and has converged
      // to a local minimum.
      bestSol = nextStep.X;
      bestObjVal = nextObjVal;
      //console.log("new best feasible solution found");
    }
    weight = Math.min(weight * WEIGHT_RATIO, WEIGHT_MAX);
    lastStep = nextStep;
  }
  return bestSol;
}

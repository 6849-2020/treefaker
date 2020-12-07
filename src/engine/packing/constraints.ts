/**
 * Augmented Lagrangian methods for disk packing.
 *
 * This is essentially a reimplementation of Robert J. Lang's
 * augmented Lagrangian + line search solver.
 */
import { matrix, zeros, size } from "mathjs";

export type PackingMap = Map<string, Map<string, Map<string, number>>>;
export type Constraint = (X: matrix) => number;
export type GradConstraint = (X: matrix) => matrix;
export type ConstraintSet = {
  constraints: Constraint[];
  grad: GradConstraint[];
};

const MAX_SCALE = 2;

function lbConstraint(idx: number, lb: number): Constraint {
  return function(X: matrix): number {
    if (X[idx] < lb) {
      return lb - X[idx];
    }
    return 0;
  };
}

function gradLbConstraint(idx: number, lb: number, n: number): GradConstraint {
  return function(X: matrix): number {
    const deriv = zeros([n]);
    if (X[idx] < lb) {
      deriv[idx] = -1;
    }
    return deriv;
  };
}

function ubConstraint(idx: number, ub: number): Constraint {
  return function(X: matrix): number {
    if (X[idx] > ub) {
      return X[idx] - ub;
    }
    return 0;
  };
}

function gradUbConstraint(idx: number, ub: number, n: number): GradConstraint {
  return function(X: matrix): number {
    const deriv = zeros([n]);
    if (X[idx] > ub) {
      deriv[idx] = 1;
    }
    return deriv;
  };
}

function overlapConstraint(dists: matrix, i: number, j: number): Constraint {
  const n = size(dists)[0];
  const length = dists[i][j];
  return function(X: matrix): number {
    const scale = X[2 * n];
    const dist = Math.sqrt(
      Math.pow(X[i] - X[j], 2) + Math.pow(X[i + n] - X[j + n], 2)
    );
    const scaledLength = scale * length;
    return scaledLength - dist;
  };
}

function gradOverlapConstraint(
  dists: matrix,
  i: number,
  j: number
): GradConstraint {
  const n = size(dists)[0];
  const length = dists[i][j];
  return function(X: matrix): matrix {
    const dist = Math.sqrt(
      Math.pow(X[i] - X[j], 2) + Math.pow(X[i + n] - X[j + n], 2)
    );
    const invDist = 1 / dist;
    const deriv = zeros([2 * n + 1]);
    deriv[i] = invDist * (X[j] - X[i]);
    deriv[j] = invDist * (X[i] - X[j]);
    deriv[i + n] = invDist * (X[j + n] - X[i + n]);
    deriv[j + n] = invDist * (X[i + n] - X[j + n]);
    deriv[2 * n] = length;
    return deriv;
  };
}

export function genConstraints(dists: matrix): Constraint[] {
  const n = size(dists)[0];
  const lbConstraints = Array(2 * n)
    .fill(null)
    .map((_, i) => lbConstraint(i, 0));
  const ubConstraints = Array(2 * n)
    .fill(null)
    .map((_, i) => ubConstraint(i, 1));
  const overlapConstraints: Constraint[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      overlapConstraints.push(overlapConstraint(dists, i, j));
    }
  }
  return [
    lbConstraint(2 * n, 0),
    ubConstraint(2 * n, MAX_SCALE),
    ...lbConstraints,
    ...ubConstraints,
    ...overlapConstraints
  ];
}

export function genGradConstraints(dists: matrix): GradConstraint[] {
  const n = size(dists)[0];
  const gradLbConstraints = Array(2 * n)
    .fill(null)
    .map((_, i) => gradLbConstraint(i, 0, 2 * n + 1));
  const gradUbConstraints = Array(2 * n)
    .fill(null)
    .map((_, i) => gradUbConstraint(i, 1, 2 * n + 1));
  const gradOverlapConstraints: GradConstraint[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      gradOverlapConstraints.push(gradOverlapConstraint(dists, i, j));
    }
  }
  return [
    gradLbConstraint(2 * n, 0, 2 * n + 1),
    gradUbConstraint(2 * n, MAX_SCALE, 2 * n + 1),
    ...gradLbConstraints,
    ...gradUbConstraints,
    ...gradOverlapConstraints
  ];
}

export function toMatrix(nodes: PackingMap): matrix {
  const keys = Array.from(nodes.keys()).sort();
  const n = keys.length;
  const dists = zeros([n, n]);

  for (let i = 0; i < n; i++) {
    const iKey = keys[i];
    for (let j = 0; j < n; j++) {
      const jKey = keys[j];
      if (i !== j) {
        dists[i][j] = nodes
          .get(iKey)
          ?.get(jKey)
          ?.get(jKey);
      }
    }
  }
  return dists;
}

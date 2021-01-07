<template>
  <div id="treeViewBox" class="viewBox" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import {
  JSXGraph,
  Board,
  Coords,
  COORDS_BY_USER,
  COORDS_BY_SCREEN,
  getPosition
} from "jsxgraph";
import { TreeGraph, TreeNode, TreeEdge } from "../engine/packing";

@Component
export default class TreeView extends Vue {
  readyToCreateNewPoint: boolean;
  pointIdsInUse: Set<number>; // A set of all labels currently in use.
  nextPointId: number; // The least positive integer not in pointIdsInUse.
  treePoints: Map<any, any>; // Map from all points to set of incident lines.
  edgeLengthLabelOf: Map<any, any>; // Map from each line to its edge length label.
  adjustVerts: any;
  adjustPt: any;
  adjustAngle: any;
  treeBoard: Board | null;
  undoPoints: Array<TreeGraph>;
  currentUndoPoint: number;

  constructor() {
    super();

    // ugh, apparently i need to copy/paste this because typescript isn't smart enough to realize resetState() assigns to these -alt
    this.readyToCreateNewPoint = true;
    this.pointIdsInUse = new Set();
    this.nextPointId = 1;
    this.edgeLengthLabelOf = new Map();
    this.treePoints = new Map();
    this.edgeLengthLabelOf = new Map();
    this.adjustVerts = undefined;
    this.adjustPt = undefined;
    this.adjustAngle = undefined;

    this.treeBoard = null;
    this.undoPoints = [];
    this.currentUndoPoint = 0;
  }

  resetState() {
    this.readyToCreateNewPoint = true; // Lock to make sure we don't try to create several new points in one ctrl press.
    this.pointIdsInUse = new Set();
    this.nextPointId = 1;
    this.edgeLengthLabelOf = new Map();
    this.treePoints = new Map();
    this.edgeLengthLabelOf = new Map();
    this.adjustVerts = undefined;
    this.adjustPt = undefined;
    this.adjustAngle = undefined;
  }

  mounted() {
    this.treeBoard = JSXGraph.initBoard("treeViewBox", {
      boundingbox: [0, 10, 10, 0],
      showCopyright: false
    });

    const initialPoint1 = this.createPoint(5, 4);
    const initialPoint2 = this.createPoint(5, 6);
    this.treePoints.set(initialPoint1, new Set());
    this.treePoints.set(initialPoint2, new Set());
    this.createLine(initialPoint1, initialPoint2);

    // undo/redo
    this.setUndoPoint(true);
    window.addEventListener("keydown", e => {
      if (
        e.ctrlKey &&
        e.key === "y" &&
        this.currentUndoPoint < this.undoPoints.length - 1
      ) {
        this.deserialize(this.undoPoints[++this.currentUndoPoint]);
      } else if (e.ctrlKey && e.key === "z" && this.currentUndoPoint > 0) {
        this.deserialize(this.undoPoints[--this.currentUndoPoint]);
      }
    });

    // adjust
    this.treeBoard.on("move", e => {
      if (!this.adjustVerts) return;
      const [cx, cy] = this.toCoords(e),
        newAngle = Math.atan2(cy - this.adjustPt[1], cx - this.adjustPt[0]),
        s = Math.sin(newAngle - this.adjustAngle),
        c = Math.cos(newAngle - this.adjustAngle);
      for (const pt of this.adjustVerts) {
        pt.v.moveTo([
          c * (pt.orig[0] - this.adjustPt[0]) -
            s * (pt.orig[1] - this.adjustPt[1]) +
            this.adjustPt[0] +
            pt.offset[0],
          s * (pt.orig[0] - this.adjustPt[0]) +
            c * (pt.orig[1] - this.adjustPt[1]) +
            this.adjustPt[1] +
            pt.offset[1]
        ]);
      }
    });
  }

  serialize(): TreeGraph {
    const tree = new TreeGraph();
    const newPoints = new Map();

    // Generate nodes.
    this.treePoints.forEach(function(edges: any, point: any) {
      const px = point.X();
      const py = point.Y();
      const v = new TreeNode(point.name.toString(), px, py);
      tree.addNode(v);
      newPoints.set([px, py].toString(), v);
    });

    // Generate deduplicated edges.
    const seen = new Set();
    this.treePoints.forEach(function(edges: any) {
      for (const edge of edges) {
        const p1 = edge.point1;
        const p2 = edge.point2;
        const p1x = p1.X();
        const p1y = p1.Y();
        const p2x = p2.X();
        const p2y = p2.Y();
        if (
          !seen.has([p1x, p1y, p2x, p2y].toString()) &&
          !seen.has([p2x, p2y, p1x, p1y].toString())
        ) {
          const v1 = newPoints.get([p1x, p1y].toString());
          const v2 = newPoints.get([p2x, p2y].toString());
          const length = Math.sqrt(
            Math.pow(p1x - p2x, 2) + Math.pow(p1y - p2y, 2)
          );
          const edge = new TreeEdge(v1, v2, length);
          tree.addEdge(edge);
          seen.add([p1x, p1y, p2x, p2y].toString());
          seen.add([p2x, p2y, p1x, p1y].toString());
        }
      }
    });

    return tree;
  }

  deserialize(tree: TreeGraph) {
    this.treeBoard.suspendUpdate();

    this.treeBoard.removeObject(Array.from(this.treeBoard.objectsList));
    this.resetState();

    const nodeToPoint = new Map();

    tree.nodes.forEach(node => {
      const point = this.createPoint(node.x, node.y, parseInt(node.id));
      this.treePoints.set(point, new Set());
      nodeToPoint.set(node.id, point);
    });
    this.resetNextPointId();

    tree.edges.forEach(edge => {
      this.createLine(
        nodeToPoint.get(edge.to.id),
        nodeToPoint.get(edge.from.id)
      );
    });

    this.treeBoard.unsuspendUpdate();
  }

  setUndoPoint(first?: boolean) {
    const tree: TreeGraph = this.serialize();
    if (first) {
      this.undoPoints = [tree];
    } else {
      if (this.currentUndoPoint != this.undoPoints.length - 1) {
        this.undoPoints = this.undoPoints.slice(0, this.currentUndoPoint + 1);
      }
      this.undoPoints.push(tree);
      ++this.currentUndoPoint;
    }
  }

  propagate() {
    /* Update the global state with a `TreeGraph` representation. */
    this.$store.commit(
      "updateTreeGraph",
      this.undoPoints[this.currentUndoPoint]
    );
  }

  findSubtree(
    vertices: any[],
    edges: Set<any>,
    fromPoint: any,
    toPoint: any
  ): any[] {
    vertices.push(toPoint);
    for (const incidentLine of this.treePoints.get(toPoint)) {
      edges.add(incidentLine);
      for (const otherPoint of [incidentLine.point1, incidentLine.point2]) {
        if (otherPoint != fromPoint && otherPoint != toPoint) {
          this.findSubtree(vertices, edges, toPoint, otherPoint);
        }
      }
    }
    return [vertices, edges];
  }

  changeEdgeLength(point1: any, point2: any) {
    const newDistance = Number(
      prompt(
        "Distance between point " +
          point1.name +
          " and point " +
          point2.name +
          ":",
        ""
      )
    );
    if (newDistance > 0) {
      const oldDistance = point1.Dist(point2);
      const xGap = point2.X() - point1.X();
      const yGap = point2.Y() - point1.Y();
      let dx = (xGap * newDistance) / oldDistance - xGap;
      let dy = (yGap * newDistance) / oldDistance - yGap;
      const subtree1 = this.findSubtree([], new Set(), point2, point1)[0];
      const subtree2 = this.findSubtree([], new Set(), point1, point2)[0];
      let smallerSubtree;
      if (subtree1.length < subtree2.length) {
        smallerSubtree = subtree1;
        dx = -dx;
        dy = -dy;
      } else {
        smallerSubtree = subtree2;
      }
      for (const point of smallerSubtree) {
        point.setPosition(COORDS_BY_USER, [point.X() + dx, point.Y() + dy]);
      }
      this.setUndoPoint();
    }
  }

  // Removes a line from the treeBoard.
  deleteLine(incidentLine: any) {
    for (const endPoint of [incidentLine.point1, incidentLine.point2]) {
      const setOfIncidentEdges = this.treePoints.get(endPoint);
      setOfIncidentEdges.delete(incidentLine);
    }
    this.treeBoard.removeObject(incidentLine);
    const edgeLengthLabel = this.edgeLengthLabelOf.get(incidentLine);
    this.treeBoard.removeObject(edgeLengthLabel);
    this.edgeLengthLabelOf.delete(incidentLine);
  }

  // Removes the smaller component of T \ {{point1, point2}} from the treeBoard.
  deleteSubtree(point1: any, point2: any) {
    const [subtree1Vertices, subtree1Edges] = this.findSubtree(
      [],
      new Set(),
      point2,
      point1
    );
    const [subtree2Vertices, subtree2Edges] = this.findSubtree(
      [],
      new Set(),
      point1,
      point2
    );
    let smallerSubtreeVertices;
    let smallerSubtreeEdges;
    if (subtree1Vertices.length < subtree2Vertices.length) {
      smallerSubtreeVertices = subtree1Vertices;
      smallerSubtreeEdges = subtree1Edges;
    } else {
      smallerSubtreeVertices = subtree2Vertices;
      smallerSubtreeEdges = subtree2Edges;
    }
    for (const line of smallerSubtreeEdges) {
      this.deleteLine(line);
    }
    for (const point of smallerSubtreeVertices) {
      this.pointIdsInUse.delete(point.name);
      this.treeBoard.removeObject(point);
      this.treePoints.delete(point);
    }
    this.resetNextPointId();
    this.setUndoPoint();
  }

  // Creates a line between point1 and point2.
  createLine(point1: any, point2: any): any {
    const newLine = this.treeBoard.create("segment", [point1, point2], {
      fixed: true
    });
    const newLineEdgeLengthLabel = this.treeBoard.create(
      "text",
      [
        function(x: any) {
          return (point1.X() + point2.X()) / 2;
        },
        function(x: any) {
          return (point1.Y() + point2.Y()) / 2;
        },
        function() {
          return point1.Dist(point2).toFixed(2);
        }
      ],
      { highlight: false }
    );
    this.treePoints.get(point1).add(newLine);
    this.treePoints.get(point2).add(newLine);
    this.edgeLengthLabelOf.set(newLine, newLineEdgeLengthLabel);

    newLine.on(
      "up",
      function(this: TreeView, e) {
        if (this.adjustVerts) {
          this.adjustVerts = undefined;
          this.adjustPt = undefined;
          this.adjustAngle = undefined;
          this.setUndoPoint();
        } else if (e.shiftKey) this.deleteSubtree(point1, point2);
      }.bind(this)
    );

    newLine.on(
      "down",
      function(this: TreeView, e) {
        if (e.which === 3) this.changeEdgeLength(point1, point2);
        if (e.altKey) {
          const [cx, cy] = this.toCoords(e),
            distsq1 =
              Math.pow(point1.X() - cx, 2) + Math.pow(point1.Y() - cy, 2),
            distsq2 =
              Math.pow(point2.X() - cx, 2) + Math.pow(point2.Y() - cy, 2),
            centerPoint = distsq1 < distsq2 ? point2 : point1,
            otherPoint = distsq1 < distsq2 ? point1 : point2,
            [verts, _] = this.findSubtree(
              [],
              new Set(),
              centerPoint,
              otherPoint
            );
          this.adjustVerts = verts.map(v => ({
            orig: e.ctrlKey ? [otherPoint.X(), otherPoint.Y()] : [v.X(), v.Y()],
            offset: e.ctrlKey
              ? [v.X() - otherPoint.X(), v.Y() - otherPoint.Y()]
              : [0, 0],
            v: v
          }));
          this.adjustPt = [centerPoint.X(), centerPoint.Y()];
          this.adjustAngle = Math.atan2(
            cy - centerPoint.Y(),
            cx - centerPoint.X()
          );
        }
      }.bind(this)
    );

    return newLine;
  }

  // Creates a point at the given user coordinates.
  createPoint(x: any, y: any, forceName?: number): any {
    const name = forceName || this.nextPointId;
    const point = this.treeBoard.create("point", [x, y], {
      name: name,
      label: { offset: [6, 6], highlight: false }
    });
    point.on(
      "up",
      function(this: TreeView, e: any) {
        if (this.readyToCreateNewPoint) this.setUndoPoint();
        this.readyToCreateNewPoint = true;
      }.bind(this)
    );
    point.on(
      "down",
      function(this: TreeView, e: any) {
        if (e.ctrlKey && this.readyToCreateNewPoint) {
          this.readyToCreateNewPoint = false;
          const newPoint = this.createPoint(point.X(), point.Y());
          this.treePoints.set(newPoint, new Set());

          // Redraw lines to new point.
          const incidentLines: Set<any> = new Set(this.treePoints.get(point));
          for (const incidentLine of incidentLines) {
            let otherPoint = null;
            if (incidentLine.point1 === point) {
              otherPoint = incidentLine.point2;
            } else if (incidentLine.point2 === point) {
              otherPoint = incidentLine.point1;
            } else {
              console.log("Error: Line in treePoints not incident.");
              console.log(point.name);
              console.log(incidentLine.point1.name);
              console.log(incidentLine.point2.name);
            }
            this.deleteLine(incidentLine);
            this.createLine(otherPoint, point); // TODO If it stops switching the element being dragged, change point to newPoint and take out the break.
            break;
          }
          this.createLine(point, newPoint);
        }
      }.bind(this)
    );
    this.pointIdsInUse.add(name);
    if (!forceName) {
      while (this.pointIdsInUse.has(this.nextPointId)) {
        this.nextPointId++;
      }
    }
    return point;
  }

  resetNextPointId() {
    this.nextPointId = 1;
    while (this.pointIdsInUse.has(this.nextPointId)) {
      this.nextPointId++;
    }
  }

  // TODO doesn't handle multitouch properly, see https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates -alt
  toCoords(e): any[] {
    const p1 = this.treeBoard.getCoordsTopLeftCorner(e, 0),
      p2 = getPosition(e),
      coords = new Coords(
        COORDS_BY_SCREEN,
        [p2[0] - p1[0], p2[1] - p1[1]],
        this.treeBoard
      );
    return [coords.usrCoords[1], coords.usrCoords[2]];
  }
}
</script>

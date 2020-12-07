<template>
  <div id="treeViewBox" class="viewBox" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph, Board, COORDS_BY_USER } from "jsxgraph";
import { TreeGraph, TreeNode, TreeEdge } from "../engine/packing";

@Component
export default class TreeView extends Vue {
  readyToCreateNewPoint: boolean;
  pointIdsInUse: Set<number>; // A set of all labels currently in use.
  nextPointId: number; // The least positive integer not in pointIdsInUse.
  treePoints: Map<any, any>; // Map from all points to set of incident lines.
  edgeLengthLabelOf: Map<any, any>; // Map from each line to its edge length label.
  treeBoard: Board | null;

  constructor() {
    super();
    this.readyToCreateNewPoint = true; // Lock to make sure we don't try to create several new points in one ctrl press.
    this.pointIdsInUse = new Set();
    this.nextPointId = 1;
    this.edgeLengthLabelOf = new Map();
    this.treePoints = new Map();
    this.edgeLengthLabelOf = new Map();
    this.treeBoard = null;
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
  }

  propagate() {
    /* Update the global state with a `TreeGraph` representation. */
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

    // Save the new tree to global state.
    this.$store.commit("updateTreeGraph", tree);
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
    this.nextPointId = 1;
    while (this.pointIdsInUse.has(this.nextPointId)) {
      this.nextPointId++;
    }
  }

  // Creates a line between point1 and point2.
  createLine(point1: any, point2: any): any {
    const newLine = this.treeBoard.create("segment", [point1, point2], {
      fixed: true
    });
    const newLineEdgeLengthLabel = this.treeBoard.create("text", [
      function(x: any) {
        return (point1.X() + point2.X()) / 2;
      },
      function(x: any) {
        return (point1.Y() + point2.Y()) / 2;
      },
      function() {
        return point1.Dist(point2).toFixed(2);
      }
    ]);
    this.treePoints.get(point1).add(newLine);
    this.treePoints.get(point2).add(newLine);
    this.edgeLengthLabelOf.set(newLine, newLineEdgeLengthLabel);
    newLine.on("up", function(this: TreeView, e) {
      if (e.shiftKey) this.deleteSubtree(point1, point2);
    }.bind(this));
    newLine.on("down", function(this: TreeView, e) {
      if (e.which === 3) this.changeEdgeLength(point1, point2);
    }.bind(this));
    return newLine;
  }

  // Creates a point at the given user coordinates.
  createPoint(x: any, y: any): any {
    const point = this.treeBoard.create("point", [x, y], {
      name: this.nextPointId
    });
    point.on("up", function(this: TreeView, e: any) {
      this.readyToCreateNewPoint = true;
    }.bind(this));
    point.on("down", function(this: TreeView, e: any) {
      if (e.ctrlKey && this.readyToCreateNewPoint) {
        this.readyToCreateNewPoint = false;
        const newPoint = this.createPoint(point.X(), point.Y());
        this.treePoints.set(newPoint, new Set());

        // Redraw lines to new point.
        const incidentLines : Set<any> = new Set(this.treePoints.get(point));
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
    }.bind(this));
    this.pointIdsInUse.add(this.nextPointId);
    while (this.pointIdsInUse.has(this.nextPointId)) {
      this.nextPointId++;
    }
    return point;
  }
}
</script>

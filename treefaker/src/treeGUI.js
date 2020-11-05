treeBoard = JXG.JSXGraph.initBoard('treeViewBox', {
  boundingbox: [0, 10, 10, 0],
  showCopyright: false
});
packingBoard = JXG.JSXGraph.initBoard('packingViewBox', {
  boundingbox: [-.05, 1.05, 1.05, -.05],
  showCopyright: false,
  showNavigation: false
});
creasesBoard = JXG.JSXGraph.initBoard('creasesViewBox', {
  boundingbox: [-.05, 1.05, 1.05, -.05],
  showCopyright: false,
  showNavigation: false
});

readyToCreateNewPoint = true; // Lock to make sure we don't try to create several new points in one ctrl press.
pointIdsInUse = new Set(); // A set of all labels currently in use.
nextPointId = 1; // The least positive integer not in pointIdsInUse.
treePoints = null; // Map from all points to set of incident lines.
treePointsSet = null; // Set of all points.
edgeLengthLabelOf = null; // Map from each line to its edge length label.

// Finds the nodes and the edges touching the component of T \ {fromPoint} that contains toPoint.
function findSubtree(vertices, edges, fromPoint, toPoint) {
  vertices.push(toPoint);
  for (var incidentLine of treePoints.get(toPoint)) {
    edges.add(incidentLine);
    for (var otherPoint of [incidentLine.point1, incidentLine.point2]) {
      if (otherPoint != fromPoint && otherPoint != toPoint) {
        findSubtree(vertices, edges, toPoint, otherPoint);
      }
    }
  }
  return [vertices, edges];
}

// Prompts the user to change the length of a tree edge.
function changeEdgeLength(point1, point2) {
    var newDistance = Number(prompt("Distance between point " + point1.name + " and point " + point2.name + ":", ""));
    if (newDistance > 0) {
      var oldDistance = point1.Dist(point2);
      var xGap = point2.X() - point1.X();
      var yGap = point2.Y() - point1.Y();
      var dx = xGap * newDistance / oldDistance - xGap;
      var dy = yGap * newDistance / oldDistance - yGap;
      var subtree1 = findSubtree([], new Set(), point2, point1)[0];
      var subtree2 = findSubtree([], new Set(), point1, point2)[0];
      var smallerSubtree;
      if (subtree1.length < subtree2.length) {
        smallerSubtree = subtree1;
        dx = -dx;
        dy = -dy;
      } else {
        smallerSubtree = subtree2;
      }
      for (var point of smallerSubtree) {
        point.setPosition(JXG.COORDS_BY_USER, [point.X() + dx, point.Y() + dy])
      }
    }
}

// Removes a line from the treeBoard.
function deleteLine(incidentLine) {
  for (var endPoint of [incidentLine.point1, incidentLine.point2]) {
    var setOfIncidentEdges = treePoints.get(endPoint);
    setOfIncidentEdges.delete(incidentLine);
  }
  treeBoard.removeObject(incidentLine);
  var edgeLengthLabel = edgeLengthLabelOf.get(incidentLine);
  treeBoard.removeObject(edgeLengthLabel);
  edgeLengthLabelOf.delete(incidentLine);
}

// Removes the smaller component of T \ {{point1, point2}} from the treeBoard.
function deleteSubtree(point1, point2) {
  var [subtree1Vertices, subtree1Edges] = findSubtree([], new Set(), point2, point1);
  var [subtree2Vertices, subtree2Edges] = findSubtree([], new Set(), point1, point2);
  var smallerSubtreeVertices;
  var smallerSubtreeEdges;
  if (subtree1Vertices.length < subtree2Vertices.length) {
    smallerSubtreeVertices = subtree1Vertices;
    smallerSubtreeEdges = subtree1Edges;
  } else {
    smallerSubtreeVertices = subtree2Vertices;
    smallerSubtreeEdges = subtree2Edges;
  }
  for (var line of smallerSubtreeEdges) {
    deleteLine(line);
  }
  for (var point of smallerSubtreeVertices) {
    pointIdsInUse.delete(point.name);
    treeBoard.removeObject(point);
    treePoints.delete(point);
    treePointsSet.delete(point);
  }
  nextPointId = 1;
  while (pointIdsInUse.has(nextPointId)) {
    nextPointId++;
  }
}

// Creates a line between point1 and point2.
function createLine(point1, point2) {
  var newLine = treeBoard.create('segment', [point1, point2], {fixed: true});
  var newLineEdgeLengthLabel = treeBoard.create('text', [
    function(x) {
      return (point1.X() + point2.X()) / 2
    },
    function(x) {
      return (point1.Y() + point2.Y()) / 2
    },
    function () {
      return point1.Dist(point2).toFixed(2)
    }
  ]);
  treePoints.get(point1).add(newLine);
  treePoints.get(point2).add(newLine);
  edgeLengthLabelOf.set(newLine, newLineEdgeLengthLabel);
  newLine.on("up", function(e) {if (e.shiftKey) deleteSubtree(point1, point2)});
  newLine.on("down", function(e) {if (e.which == 3) changeEdgeLength(point1, point2)});
  newLineEdgeLengthLabel.on("down", function(e) {if (e.which == 3) changeEdgeLength(point1, point2)});
  return newLine;
}

// Creates a point at the given user coordinates.
function createPoint(x, y) {
  var point = treeBoard.create('point', [x, y], {name: nextPointId})
  point.on("up", function(e) {readyToCreateNewPoint = true})
  point.on("down", function(e) {
    if (e.ctrlKey && readyToCreateNewPoint) {
      readyToCreateNewPoint = false;
      var newPoint = createPoint(point.X(), point.Y());
      treePoints.set(newPoint, new Set());
      treePointsSet.add(newPoint);
      
      // Redraw lines to new point.
      for (var incidentLine of new Set(treePoints.get(point))) {
        var otherPoint = null;
        if (incidentLine.point1 == point) {
          otherPoint = incidentLine.point2;
        } else if (incidentLine.point2 == point) {
          otherPoint = incidentLine.point1;
        } else {
          console.log("Error: Line in treePoints not incident.");
          console.log(point.name);
          console.log(incidentLine.point1.name);
          console.log(incidentLine.point2.name);
        }
        deleteLine(incidentLine);
        createLine(otherPoint, point); // TODO If it stops switching the element being dragged, change point to newPoint and take out the break.
        break;
      }
      
      createLine(point, newPoint);
    }
  });
  pointIdsInUse.add(nextPointId);
  while (pointIdsInUse.has(nextPointId)) {
    nextPointId++;
  }
  return point;
}

// Initialization.
initialPoint1 = createPoint(5, 4);
initialPoint2 = createPoint(5, 6);
treePoints = new WeakMap();
treePoints.set(initialPoint1, new Set());
treePoints.set(initialPoint2, new Set());
treePointsSet = new Set([initialPoint1, initialPoint2]);
edgeLengthLabelOf = new WeakMap();
createLine(initialPoint1, initialPoint2);


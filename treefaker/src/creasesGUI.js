creases = null; // TODO Decide how to encode creases.

function showCreases() {
  JXG.JSXGraph.freeBoard(creasesBoard);
  creasesBoard = JXG.JSXGraph.initBoard('creasesViewBox', {
    boundingbox: [0, 1, 1, 0],
    showCopyright: false,
    showNavigation: false
  });
  // TODO(Jamie) Construct JSXGraph visualization of creases from creases object.
}

function computeCreases() {
  // TODO(Jamie) Replace with universal molecule algorithm, probably move this function to another file.
  var creases = null;
  return creases;
}

function computeAndShowCreases() {
  if (diskPacking == null) {
    computeAndShowDiskPacking(true);
  } else {
    creases = computeCreases();
    showCreases();
  }
}

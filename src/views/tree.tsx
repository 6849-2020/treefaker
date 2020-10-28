import React  from 'react';
import JXGBoard from 'jsxgraph-react-js';

// copied from example
const logicJS = (brd: any) => {
  brd.suspendUpdate();
  var a = brd.create('slider', [[2, 8], [6, 8], [0, 3, 6]], { name: 'a' });
  var b = brd.create('slider', [[2, 7], [6, 7], [0, 2, 6]], { name: 'b' });
  var A = brd.create('slider', [[2, 6], [6, 6], [0, 3, 6]], { name: 'A' });
  var B = brd.create('slider', [[2, 5], [6, 5], [0, 3, 6]], { name: 'B' });
  var delta = brd.create('slider', [[2, 4], [6, 4], [0, 0, Math.PI]], { name: '&delta;' });

  var c = brd.create('curve', [
    function (t: number) { return A.Value() * Math.sin(a.Value() * t + delta.Value()); },
    function (t: number) { return B.Value() * Math.sin(b.Value() * t); },
    0, 2 * Math.PI], { strokeColor: '#aa2233', strokeWidth: 3 });
  brd.unsuspendUpdate();
}

export function TreeView() {
  return (
    <JXGBoard
      logic={logicJS}
      boardAttributes={{ axis: true, boundingbox: [-12, 10, 12, -10] }}
      style={{ border: "3px solid red" }}
    />
  );
}




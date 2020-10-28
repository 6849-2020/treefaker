import React from 'react';
import { useState } from 'react';
import { TreeView } from './views/tree';
import { CreasesView } from './views/creases';
import { PackingView } from './views/packing';
import Row from 'react-bootstrap/Row';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

enum View { Tree, Creases, Packing };

function App() {
  const [view, setView] = useState(View['Tree']);
  return (
    <Container fluid>
      <Row>
        <Navbar fixed="top">
          <Navbar.Brand href="#home">TreeMaker</Navbar.Brand>
          <Navbar.Toggle aria-controls="responsive-navbar-nav" />
          <Navbar.Collapse id="responsive-navbar-naReact-Bootstrap<v">
            <Nav className="mr-auto">
              <Nav.Link href="#" onClick={() => setView(View['Tree'])}>Tree</Nav.Link>
              <Nav.Link href="#" onClick={() =>setView(View['Packing'])}>Packing</Nav.Link>
              <Nav.Link href="#" onClick={() => setView(View['Creases'])}>Creases</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Navbar>
      </Row>
      <Row>
        <div className="view">
          { view === View['Tree'] && <TreeView /> }
          { view === View['Creases'] && <CreasesView /> }
          { view === View['Packing'] && <PackingView /> }
        </div>
      </Row>
    </Container>
  );
}

/*
*/

export default App;

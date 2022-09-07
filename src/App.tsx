import React, { useState } from "react";
import { Button } from 'react-bootstrap';
import "bootstrap/dist/css/bootstrap.min.css";

export default function App() {
  const [count, setCount] = useState<number>(0);
  return (
    <div>
      <div>{count}</div>
      <Button onClick={() => setCount(count + 1)}>Count+</Button>
    </div>
  );
};

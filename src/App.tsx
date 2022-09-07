import React, { useState } from "react";

export default function App() {
  const [count, setCount] = useState<number>(0);
  return (
    <div>
      <h1>Hello</h1>
      <h2>{count}</h2>
      <button onClick={() => setCount(count + 1)}>add count</button>
    </div>
  );
};

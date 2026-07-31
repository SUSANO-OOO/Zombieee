import { AshfallGame } from "./AshfallGame";
import { PwaGate } from "./PwaGate";

export default function Home() {
  return (
    <PwaGate>
      <AshfallGame />
    </PwaGate>
  );
}

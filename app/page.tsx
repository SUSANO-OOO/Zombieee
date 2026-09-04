import { GameEntry } from "./GameEntry";
import { PwaGate } from "./PwaGate";

export default function Home() {
  return (
    <PwaGate>
      <GameEntry />
    </PwaGate>
  );
}

import { LandscapeGate } from "./LandscapeGate";
import { FictionNotice } from "./FictionNotice";
import { GameEntry } from "./GameEntry";
import { PwaGate } from "./PwaGate";

export default function Home() {
  return (
    <PwaGate>
      <LandscapeGate><FictionNotice><GameEntry /></FictionNotice></LandscapeGate>
    </PwaGate>
  );
}

import { LandscapeGate } from "../LandscapeGate";
import { FictionNotice } from "../FictionNotice";
import { GameEntry } from "../GameEntry";
import { PwaGate } from "../PwaGate";

export default function V100Page() {
  return <PwaGate><LandscapeGate><FictionNotice><GameEntry campaignOnly /></FictionNotice></LandscapeGate></PwaGate>;
}

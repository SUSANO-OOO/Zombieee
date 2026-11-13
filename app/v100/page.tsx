import { LandscapeGate } from "../LandscapeGate";
import { FictionNotice } from "../FictionNotice";
import { V100Campaign } from "../V100Campaign";
import { PwaGate } from "../PwaGate";

export default function V100Page() {
  return <PwaGate><LandscapeGate><FictionNotice><V100Campaign /></FictionNotice></LandscapeGate></PwaGate>;
}

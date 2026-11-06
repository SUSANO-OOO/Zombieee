import {createHash} from 'node:crypto';
// Text provenance uses Git's LF form. No JSON parsing, whitespace folding,
// sorting, or value normalization: every other byte remains significant.
export function gaitSourceHash(bytes) {
  return createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n','\n')).digest('hex');
}

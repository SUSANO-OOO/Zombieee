import assert from 'node:assert/strict';
// A legacy comparison may restore only a previously implicit Linux host,
// after proving the current host is the explicit supported replacement.
// Commands, limits, permissions, Mac hosts and matrix expressions are untouched.
export function assertAndRestorePinnedLinuxHostsForLegacyComparison(workflow){
 let count=0;
 const restore=(holder,key)=>{const value=holder[key];if(typeof value==='string'&&value.startsWith('ubuntu')){assert.equal(value,'ubuntu-24.04','Current Linux browser host must stay supported and explicit');holder[key]='ubuntu-latest';count++;}};
 for(const job of Object.values(workflow.jobs)){
  restore(job,'runs-on');
  const matrix=job.strategy?.matrix;
  if(Array.isArray(matrix?.include))for(const row of matrix.include)restore(row,'os');
  if(Array.isArray(matrix?.os))for(let i=0;i<matrix.os.length;i++)restore(matrix.os,i);
 }
 assert.ok(count>0,'Expected at least one explicit Linux host');return count;
}

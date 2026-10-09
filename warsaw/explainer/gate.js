// Teaching model of tools/review/gate.mjs:64. No live agents or publication actions.
export function gateVerdict({ complete, confirmed }) {
  if (confirmed) return { state:'BLOCK', message:'A confirmed serious finding blocks the result.' };
  if (!complete) return { state:'ERROR', message:'The review is incomplete. Missing output is not a pass.' };
  return { state:'PASS', message:'These modeled conditions pass. That is not a guarantee of bug-free code.' };
}

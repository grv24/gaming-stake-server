// interface SettlementOutput {
//   mainWinner: string;
//   winningSids: string[];
// }

export function settlePokerResult(result: any): string[] {
  const winningSids: string[] = [];
  let mainWinner = "";

  // --- Main Winner ---
  if (result.newdesc.includes("Player A")) {
    mainWinner = "Player A";
    winningSids.push("1"); // Player A main
  } else if (result.newdesc.includes("Player B")) {
    mainWinner = "Player B";
    winningSids.push("2");
  }

  // --- Fancy Bets ---
  const parts = result.newdesc.split("#");

  parts.forEach((p: string | string[]) => {
    if (p.includes("A : 2card")) winningSids.push("3");
    if (p.includes("A : 7card")) winningSids.push("4");
    if (p.includes("B : 2card")) winningSids.push("5");
    if (p.includes("B : 7card")) winningSids.push("6");
  });

  return winningSids;
}

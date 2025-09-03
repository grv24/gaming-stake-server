export function settleTeen20Result(result: any): string[] {
  const winningSids: string[] = [];

  // Main winner
  if (result.win === "1") winningSids.push("1");
  if (result.win === "2") winningSids.push("2");

  // Extra fancy bets from newdesc
  const parts = result.newdesc.split("#");
  parts.forEach((p: string | string[]) => {
    if (p.includes("A : Pair")) winningSids.push("3");
    if (p.includes("B : Pair")) winningSids.push("4");
    if (p.includes("3 Baccarat A")) winningSids.push("5");
    if (p.includes("3 Baccarat B")) winningSids.push("6");
    if (p.includes("A : Red")) winningSids.push("8");
    if (p.includes("A : Black")) winningSids.push("7");
    if (p.includes("B : Red")) winningSids.push("10");
    if (p.includes("B : Black")) winningSids.push("9");
    if (p.includes("Total A")) winningSids.push("11");
    if (p.includes("Total B")) winningSids.push("12");
  });

  return winningSids;
}

export function settleDragonTiger(result: any): string[] {
  const winningSids: string[] = [];
  let mainWinner = "";

  // --- Main Winner ---
  if (result.newdesc.startsWith("Dragon")) {
    mainWinner = "Dragon";
    winningSids.push("1"); // Dragon main
  } else if (result.newdesc.startsWith("Tiger")) {
    mainWinner = "Tiger";
    winningSids.push("2"); // Tiger main
  }

  // --- Pair ---
  if (result.newdesc.includes("Pair")) {
    winningSids.push("3"); // Pair wins
  }

  // --- Check Dragon properties ---
  if (result.newdesc.includes("D : Odd")) winningSids.push("5");
  if (result.newdesc.includes("D : Even")) winningSids.push("4");
  if (result.newdesc.includes("D : Red")) winningSids.push("6");
  if (result.newdesc.includes("D : Black")) winningSids.push("7");
  if (result.newdesc.includes("D : Spade")) winningSids.push("8");
  if (result.newdesc.includes("D : Heart")) winningSids.push("9");
  if (result.newdesc.includes("D : Diamond")) winningSids.push("10");
  if (result.newdesc.includes("D : Club")) winningSids.push("11");

  // --- Check Tiger properties ---
  if (result.newdesc.includes("T : Odd")) winningSids.push("13");
  if (result.newdesc.includes("T : Even")) winningSids.push("12");
  if (result.newdesc.includes("T : Red")) winningSids.push("14");
  if (result.newdesc.includes("T : Black")) winningSids.push("15");
  if (result.newdesc.includes("T : Spade")) winningSids.push("16");
  if (result.newdesc.includes("T : Heart")) winningSids.push("17");
  if (result.newdesc.includes("T : Diamond")) winningSids.push("18");
  if (result.newdesc.includes("T : Club")) winningSids.push("19");

  return winningSids;
}

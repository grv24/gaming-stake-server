export function settleDT202Result(result: any): string[] {
  const winningSids: string[] = [];

  // Main winner
  if (result.win === "1") winningSids.push("1");
  if (result.win === "2") winningSids.push("2");
  if (result.win === "3") winningSids.push("3");

  // Parse details from newdesc
  const parts = result.newdesc.split("#");

  parts.forEach((p: string | string[]) => {
    // Pair
    if (p.includes("Yes")) winningSids.push("4");

    // Dragon Odd/Even
    if (p.includes("D : Odd")) winningSids.push("6");
    if (p.includes("D : Even")) winningSids.push("5");

    // Tiger Odd/Even
    if (p.includes("T : Odd")) winningSids.push("23");
    if (p.includes("T : Even")) winningSids.push("22");

    // Dragon Colors
    if (p.includes("D : Red")) winningSids.push("7");
    if (p.includes("D : Black")) winningSids.push("8");

    // Tiger Colors
    if (p.includes("T : Red")) winningSids.push("24");
    if (p.includes("T : Black")) winningSids.push("25");

    // Dragon Cards
    if (p.includes("D : A")) winningSids.push("9");
    if (p.includes("D : 2")) winningSids.push("10");
    if (p.includes("D : 3")) winningSids.push("11");
    if (p.includes("D : 4")) winningSids.push("12");
    if (p.includes("D : 5")) winningSids.push("13");
    if (p.includes("D : 6")) winningSids.push("14");
    if (p.includes("D : 7")) winningSids.push("15");
    if (p.includes("D : 8")) winningSids.push("16");
    if (p.includes("D : 9")) winningSids.push("17");
    if (p.includes("D : 10")) winningSids.push("18");
    if (p.includes("D : J")) winningSids.push("19");
    if (p.includes("D : Q")) winningSids.push("20");
    if (p.includes("D : K")) winningSids.push("21");

    // Tiger Cards
    if (p.includes("T : A")) winningSids.push("26");
    if (p.includes("T : 2")) winningSids.push("27");
    if (p.includes("T : 3")) winningSids.push("28");
    if (p.includes("T : 4")) winningSids.push("29");
    if (p.includes("T : 5")) winningSids.push("30");
    if (p.includes("T : 6")) winningSids.push("31");
    if (p.includes("T : 7")) winningSids.push("32");
    if (p.includes("T : 8")) winningSids.push("33");
    if (p.includes("T : 9")) winningSids.push("34");
    if (p.includes("T : 10")) winningSids.push("35");
    if (p.includes("T : J")) winningSids.push("36");
    if (p.includes("T : Q")) winningSids.push("37");
    if (p.includes("T : K")) winningSids.push("38");
  });

  return winningSids;
}

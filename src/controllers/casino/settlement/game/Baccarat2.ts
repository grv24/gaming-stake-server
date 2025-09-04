export function settleBaccaratResult(result: any): string[] {
  const winningSids: string[] = [];
  const losingSids: string[] = [];

  // --- Main Winner ---
  let mainWinner = "";
  if (result.win === "1") {
    mainWinner = "Player";
    winningSids.push("1");
    losingSids.push("2", "3");
  } else if (result.win === "2") {
    mainWinner = "Banker";
    winningSids.push("2");
    losingSids.push("1", "3");
  } else if (result.win === "3") {
    mainWinner = "Tie";
    winningSids.push("3");
    losingSids.push("1", "2");
  }

  // --- Fancy markets (Pairs & Scores) ---
  // Example result.newdesc: "Banker#-#7"
  const parts = result.newdesc.split("#");
  const score = parts[2] || "";

  // Player Pair (check if player has pair in desc)
  if (result.desc.includes("Player Pair")) {
    winningSids.push("4");
  } else {
    losingSids.push("4");
  }

  // Banker Pair
  if (result.desc.includes("Banker Pair")) {
    winningSids.push("5");
  } else {
    losingSids.push("5");
  }

  // Score ranges
  if (score) {
    const num = parseInt(score, 10);
    if (num >= 1 && num <= 4) {
      winningSids.push("6");
    } else {
      losingSids.push("6");
    }

    if (num === 5 || num === 6) {
      winningSids.push("7");
    } else {
      losingSids.push("7");
    }

    if (num === 7) {
      winningSids.push("8");
    } else {
      losingSids.push("8");
    }

    if (num === 8) {
      winningSids.push("9");
    } else {
      losingSids.push("9");
    }

    if (num === 9) {
      winningSids.push("10");
    } else {
      losingSids.push("10");
    }
  }

  return winningSids;
}

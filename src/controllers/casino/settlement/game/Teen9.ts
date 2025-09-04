// Teen9 Settlement
export function settleTeen9Result(resultData: any): string[] {
  const winners = new Set<string>();

  // Main winner from result.win
  if (resultData.win) {
    winners.add(resultData.win);
  }

  // If multiple winners are present in sid (comma separated)
  if (resultData.sid) {
    resultData.sid.split(",").forEach((id: string) => winners.add(id.trim()));
  }

  // Use newdesc to add mapped winners
  if (resultData.newdesc) {
    const desc = resultData.newdesc.toLowerCase();

    // Map hands to sid ranges
    if (desc.includes("pair")) {
      winners.add("32"); // Pair sid
    }
    if (desc.includes("flush")) {
      winners.add("33"); // Flush sid
    }
    if (desc.includes("straight")) {
      winners.add("34"); // Straight sid
    }
    if (desc.includes("trio")) {
      winners.add("35"); // Trio sid
    }
    if (desc.includes("straight flush")) {
      winners.add("36"); // Straight Flush sid
    }
    if (desc.includes("winner")) {
      winners.add("31"); // Winner sid
    }
  }

  return Array.from(winners);
}

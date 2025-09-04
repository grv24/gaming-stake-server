// export function settleResultDT20(result: any) {
//   if (!result?.data?.success || !Array.isArray(result.data.data)) {
//     return [];
//   }

//   return result.data.data.map((matchResult: { win: string; newdesc: string; }) => {
//     const winningIds: string[] = [];

//     // --- 1. Add main winner(s) from `win` field ---
//     if (matchResult.win) {
//       winningIds.push(...matchResult.win.split(",").map(s => s.trim()));
//     }

//     // --- 2. Parse `newdesc` for side bets ---
//     const desc = matchResult.newdesc || "";
//     const segments = desc.split("#"); // split into meaningful segments

//     segments.forEach(segment => {
//       // Dragon side bets
//       const dragonMatch = segment.match(/D\s*:\s*(Even|Odd|Red|Black|\d+)/gi);
//       if (dragonMatch) {
//         dragonMatch.forEach(match => winningIds.push(`D-${match.split(":")[1].trim()}`));
//       }

//       // Tiger side bets
//       const tigerMatch = segment.match(/T\s*:\s*(Even|Odd|Red|Black|\d+)/gi);
//       if (tigerMatch) {
//         tigerMatch.forEach(match => winningIds.push(`T-${match.split(":")[1].trim()}`));
//       }

//       // Optional: Add more custom parsing for other side bets if needed
//       // e.g., Teen / Poker, fancy bets, group totals, etc.
//     });

//     // Remove duplicates
//     return [...new Set(winningIds)];
//   });
// }

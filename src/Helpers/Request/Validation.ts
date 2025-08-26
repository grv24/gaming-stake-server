import { query } from "express-validator";

export const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().trim().escape(),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),
  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("fromDate must be a valid ISO date"),
  query("toDate")
    .optional()
    .isISO8601()
    .withMessage("toDate must be a valid ISO date"),
];

export function generateTransactionCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  return code;
}

export const CASINO_TYPES = [
  "dt6",
  "teen",
  "poker",
  "teen20",
  "teen9",
  "teen8",
  "poker20",
  "poker6",
  "card32eu",
  "war",
  "aaa",
  "abj",
  "dt20",
  "lucky7eu",
  "dt202",
  "teenmuf",
  "teen20c",
  "btable2",
  "goal",
  "baccarat2",
  "lucky5",
  "joker20",
  "joker1",
  "ab4",
  "lottcard",
  //  "joker20",
  //  "poison20",
];

export const DIFF_STRUCT_CASINO_TYPES = [
  "aaa",
  "abj",
  "dt20",
  "lucky7eu",
  "dt202",
  "teenmuf",
  "teen20c",
  "btable2",
  "goal",
  "baccarat2",
  "dt6",
];

// Casino types that use the alternative API endpoint
export const ALTERNATIVE_API_CASINO_TYPES = [
  "lucky5",
  "joker20",
  "joker1",
  "ab4",
  "lottcard",
  // Add other casino types that use the alternative API here
];

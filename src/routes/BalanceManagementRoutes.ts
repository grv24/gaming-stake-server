import { Router } from "express";
import { BalanceManagementController } from "../controllers/BalanceManagementController";
import { AppDataSource } from "../server";

const router = Router();

// Lazy initialization of balance management controller
let balanceController: BalanceManagementController | null = null;

const getBalanceController = () => {
  if (!balanceController) {
    balanceController = new BalanceManagementController(AppDataSource);
  }
  return balanceController;
};

// Balance Dashboard Routes
router.get("/dashboard/:userId/:userType", (req, res) =>
  getBalanceController().getBalanceDashboard(req, res)
);
router.get("/summary/:userId/:userType", (req, res) =>
  getBalanceController().getBalanceSummary(req, res)
);
router.get("/occupy/:userId/:userType", (req, res) =>
  getBalanceController().getOccupyBalance(req, res)
);

// Balance Transfer Routes
router.post("/transfer", (req, res) =>
  getBalanceController().transferBalance(req, res)
);

// Credit Reference Routes
router.put("/credit-reference", (req, res) =>
  getBalanceController().updateCreditReference(req, res)
);

// Balance Adjustment Routes
router.post("/adjust", (req, res) =>
  getBalanceController().adjustBalance(req, res)
);
router.post("/bulk-adjust", (req, res) =>
  getBalanceController().bulkAdjustBalance(req, res)
);

// Balance History Routes
router.get("/history/:userId", (req, res) =>
  getBalanceController().getBalanceHistory(req, res)
);

export default router;

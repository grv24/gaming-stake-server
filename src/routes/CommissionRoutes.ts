import { Router } from "express";
import { CommissionController } from "../controllers/CommissionController";
import { AppDataSource } from "../server";

const router = Router();

// Lazy initialization of commission controller
let commissionController: CommissionController | null = null;

const getCommissionController = () => {
  if (!commissionController) {
    commissionController = new CommissionController(AppDataSource);
  }
  return commissionController;
};

// Commission Calculation Routes
router.post("/calculate", (req, res) =>
  getCommissionController().calculateCommission(req, res)
);
router.post("/transactions", (req, res) =>
  getCommissionController().createCommissionTransactions(req, res)
);

// Commission Report Routes
router.get("/report/:userId", (req, res) =>
  getCommissionController().getCommissionReport(req, res)
);
router.get("/pending", (req, res) =>
  getCommissionController().getPendingTransactions(req, res)
);
router.get("/analytics", (req, res) =>
  getCommissionController().getCommissionAnalytics(req, res)
);

// Commission Settlement Routes
router.post("/settle", (req, res) =>
  getCommissionController().settleTransactions(req, res)
);
router.post("/settlement/daily", (req, res) =>
  getCommissionController().processDailySettlement(req, res)
);
router.post("/settlement/date-range", (req, res) =>
  getCommissionController().processSettlementForDateRange(req, res)
);
router.get("/settlement/report", (req, res) =>
  getCommissionController().generateDailySettlementReport(req, res)
);
router.get("/settlement/status/:userId", (req, res) =>
  getCommissionController().getSettlementStatus(req, res)
);

// Commission Management Routes
router.post("/cancel", (req, res) =>
  getCommissionController().cancelTransactions(req, res)
);
router.post("/refund", (req, res) =>
  getCommissionController().refundTransactions(req, res)
);
router.get("/validate/:userId", (req, res) =>
  getCommissionController().validateCommissionConfiguration(req, res)
);

// Commission Queue Status Route
router.get("/queue/status", (req, res) => {
  try {
    // This would need to be implemented in the controller
    res.json({
      success: true,
      message: "Commission queue status endpoint - implementation needed",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Casino Settlement Monitor Routes
router.get("/casino/pending-analysis", async (req, res) => {
  try {
    const { CasinoSettlementMonitor } = await import(
      "../services/CasinoSettlementMonitor"
    );
    const monitor = new CasinoSettlementMonitor(AppDataSource);
    const analysis = await monitor.analyzePendingBets();

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/casino/auto-fix", async (req, res) => {
  try {
    const { CasinoSettlementMonitor } = await import(
      "../services/CasinoSettlementMonitor"
    );
    const monitor = new CasinoSettlementMonitor(AppDataSource);
    const result = await monitor.autoFixIssues();

    res.json({
      success: true,
      message: "Auto-fix process completed",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/casino/health", async (req, res) => {
  try {
    const { CasinoSettlementMonitor } = await import(
      "../services/CasinoSettlementMonitor"
    );
    const monitor = new CasinoSettlementMonitor(AppDataSource);
    const health = await monitor.getSettlementHealth();

    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

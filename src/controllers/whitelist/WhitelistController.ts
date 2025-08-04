import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Whitelist } from '../../entities/whitelist/Whitelist';

export const getWhitelists = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;

    var whitelists;
    if (id) {
      whitelists = await whitelistRepo.findOneBy({ id });
    } else {
      whitelists = await whitelistRepo.find();
    }

    if (!whitelists) {
      return res.status(204).json({ status: "success", message: 'Whitelist not found' });
    }

    return res.status(200).json({ status: "success", message: "Whitelist fetched successfully", data: { whitelists } });
  } catch (err) {
    console.error('Error fetching whitelist:', err);
    return res.status(500).json({ status: "error", message: 'Internal Server Error' });
  }
};

export const saveWhitelist = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;
    const whitelistData = req.body;
    const createdById = req.user?.id; // Assuming user ID is available in request

    // Validate required fields
    if (!whitelistData.TechAdminUrl || !whitelistData.AdminUrl || !whitelistData.ClientUrl) {
      return res.status(400).json({ status: "error", message: 'TechAdminUrl, AdminUrl, and ClientUrl are required' });
    }

    // Validate URLs
    if (!isValidUrl(whitelistData.TechAdminUrl) || !isValidUrl(whitelistData.AdminUrl) || !isValidUrl(whitelistData.ClientUrl)) {
      return res.status(400).json({ status: "error", message: 'Invalid URL format' });
    }

    // Validate colors
    if (!isValidColor(whitelistData.primaryBackground) || !isValidColor(whitelistData.secondaryBackground)) {
      return res.status(400).json({ status: "error", message: 'Invalid color format' });
    }

    // Validate refund options
    if (whitelistData.refundOptionIsActive && 
        (whitelistData.refundPercentage < 0 || whitelistData.refundPercentage > 100)) {
      return res.status(400).json({ status: "error", message: 'Refund percentage must be between 0 and 100' });
    }

    let whitelist: Whitelist | null;
    let isNew = false;

    if (id) {
      // Update existing whitelist
      whitelist = await whitelistRepo.findOneBy({ id });
      if (!whitelist) {
        return res.status(404).json({ status: "error", message: 'Whitelist not found' });
      }
      whitelistRepo.merge(whitelist, whitelistData);
    } else {
      // Create new whitelist
      whitelist = whitelistRepo.create({
        ...whitelistData,
        createdById
      });
      isNew = true;
    }

    const result = await whitelistRepo.save(whitelist);

    return res.status(isNew ? 201 : 200).json({
      status: "success",
      message: `Whitelist ${isNew ? 'created' : 'updated'} successfully`,
      data: { whitelist: result }
    });
  } catch (err) {
    console.error('Error saving whitelist:', err);
    return res.status(500).json({ status: "error", message: 'Internal Server Error' });
  }
};

export const deleteWhitelist = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;

    const result = await whitelistRepo.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ status: "error", message: 'Whitelist not found' });
    }

    return res.status(200).json({ status: "success", message: "Whitelist deleted successfully" });
  } catch (err) {
    console.error('Error deleting whitelist:', err);
    return res.status(500).json({ status: "error", message: 'Internal Server Error' });
  }
};

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

function isValidColor(color: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color) || 
         /^#([0-9A-F]{8})$/i.test(color) ||
         /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i.test(color);
}
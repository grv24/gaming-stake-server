import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export const getWhitelists = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;

    const whitelists = id
      ? await whitelistRepo.findOneBy({ id })
      : await whitelistRepo.find();

    if (!whitelists) {
      return res.status(404).json({
        status: "error",
        message: 'Whitelist not found'
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Whitelist fetched successfully",
      data: { whitelists }
    });
  } catch (err: any) {
    console.error('Error fetching whitelist:', err);
    return res.status(500).json({
      status: "error",
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const saveWhitelist = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.query;
    const createdById = req.user?.id;

    if (!createdById) {
      return res.status(400).json({
        status: "error",
        message: 'Developer not found',
      });
    }

    // Convert plain object to Whitelist instance for validation
    const whitelistData = plainToInstance(Whitelist, req.body);
    whitelistData.createdById = createdById;

    // Validate using class-validator
    const errors = await validate(whitelistData, {
      skipMissingProperties: !!id,
      whitelist: true,
      forbidNonWhitelisted: true
    });

    if (errors.length > 0) {
      const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
      return res.status(400).json({
        status: "error",
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    if (!id && (!whitelistData.TechAdminUrl || !whitelistData.AdminUrl || !whitelistData.ClientUrl)) {
      return res.status(400).json({
        status: "error",
        message: 'TechAdminUrl, AdminUrl, and ClientUrl are required for new whitelists'
      });
    }

    if (whitelistData.refundOptionIsActive &&
      (whitelistData.refundPercentage < 0 || whitelistData.refundPercentage > 100)) {
      return res.status(400).json({
        status: "error",
        message: 'Refund percentage must be between 0 and 100'
      });
    }

    let whitelist: Whitelist | null;
    let isNew = false;

    if (id) {
      whitelist = await whitelistRepo.findOneBy({ id } as any);
      if (!whitelist) {
        return res.status(404).json({
          status: "error",
          message: 'Whitelist not found'
        });
      }
      whitelistRepo.merge(whitelist, whitelistData);
    } else {
      whitelist = whitelistData;
      isNew = true;
    }

    const result = whitelist ? await whitelistRepo.save(whitelist) : null;

    return res.status(isNew ? 201 : 200).json({
      status: "success",
      message: `Whitelist ${isNew ? 'created' : 'updated'} successfully`,
      data: { whitelist: result }
    });
  } catch (err: any) {
    console.error('Error saving whitelist:', err);
    return res.status(500).json({
      status: "error",
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const deleteWhitelist = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;

    const result = await whitelistRepo.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({
        status: "error",
        message: 'Whitelist not found'
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Whitelist deleted successfully"
    });
  } catch (err: any) {
    console.error('Error deleting whitelist:', err);
    return res.status(500).json({
      status: "error",
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
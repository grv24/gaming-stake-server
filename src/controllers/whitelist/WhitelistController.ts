import { Request, Response } from 'express';
import { getConnection } from 'typeorm';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { BaseUser } from '../../entities/users/BaseUser';

export const addNewWhiteListDomain = async (req: Request, res: Response) => {
    // Start TypeORM transaction
    const queryRunner = getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // Validate request body
        const {
            TechAdminUrl,
            AdminUrl,
            ClientUrl,
            CommonName,
            primaryBackground,
            primaryBackground90,
            secondaryBackground,
            secondaryBackground70,
            secondaryBackground85,
            textPrimary,
            textSecondary,
            sportsSettings,
        } = req.body;

        // Early validation for required fields
        if (!TechAdminUrl || !AdminUrl || !ClientUrl || !CommonName) {
            return res.status(400).json({
                success: false,
                error: `Missing ${!TechAdminUrl
                        ? "TechAdminUrl"
                        : !AdminUrl
                            ? "AdminUrl"
                            : !ClientUrl
                                ? "ClientUrl"
                                : "CommonName"
                    }`,
            });
        }

        // Function to extract base URL
        const extractBaseUrl = (url: string) => {
            try {
                const urlObj = new URL(url);
                return `${urlObj.protocol}//${urlObj.hostname}`;
            } catch (error) {
                return null;
            }
        };

        // Extract base URLs
        const baseTechAdminUrl = extractBaseUrl(TechAdminUrl);
        const baseAdminUrl = extractBaseUrl(AdminUrl);
        const baseClientUrl = extractBaseUrl(ClientUrl);

        // Check if the whitelist already exists
        const existingWhiteListData = await queryRunner.manager
            .createQueryBuilder(Whitelist, 'whitelist')
            .where('whitelist.TechAdminUrl LIKE :techAdminUrl', { techAdminUrl: `${baseTechAdminUrl}%` })
            .orWhere('whitelist.AdminUrl LIKE :adminUrl', { adminUrl: `${baseAdminUrl}%` })
            .orWhere('whitelist.ClientUrl LIKE :clientUrl', { clientUrl: `${baseClientUrl}%` })
            .getOne();

        if (existingWhiteListData) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Whitelist Already Exists.",
            });
        }

        // Create a new whitelist entry
        const whitelist = new Whitelist();
        whitelist.TechAdminUrl = TechAdminUrl;
        whitelist.AdminUrl = AdminUrl;
        whitelist.ClientUrl = ClientUrl;
        whitelist.CommonName = CommonName;
        whitelist.sportsSettings = sportsSettings;
        whitelist.primaryBackground = primaryBackground || "#0D7A8E";
        whitelist.primaryBackground90 = primaryBackground90 || "#0D7A8E";
        whitelist.secondaryBackground = secondaryBackground || "#04303e";
        whitelist.secondaryBackground70 = secondaryBackground70 || "#AE4600B3";
        whitelist.secondaryBackground85 = secondaryBackground85 || "#AE4600E6";
        whitelist.textPrimary = textPrimary || "#FFFFFF";
        whitelist.textSecondary = textSecondary || "#CCCCCC";
        whitelist.createdBy = req.profile as BaseUser;

        // Save the whitelist
        await queryRunner.manager.save(whitelist);

        // If there is a file (logo), update the whitelist with the file path
        if (req?.file?.path) {
            whitelist.Logo = req.file.path;
            await queryRunner.manager.save(whitelist);
        }

        // Commit the transaction
        await queryRunner.commitTransaction();

        // Return success response
        return res.status(200).json({
            success: true,
            msg: "New Whitelist Added",
        });
    } catch (error: any) {
        // In case of an error, abort the transaction
        if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
        }

        // Log the error
        console.error("Error in adding whitelist:", error);

        // Return detailed error response
        return res.status(500).json({
            success: false,
            error: error.message,
            name: error.name,
            stack: error.stack,
            message: error.message,
            code: error.code,
        });
    } finally {
        // Release the query runner
        if (queryRunner.isReleased === false) {
            await queryRunner.release();
        }
    }
};
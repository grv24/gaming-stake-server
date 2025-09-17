import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "whitelistsNew" })
export class WhitelistNew {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // Domain Whitelisting
    @Column({ default: false })
    isDomainWhiteListedForSportScore!: boolean;

    @Column({ default: false })
    isDomainWhiteListedForSportVideos!: boolean;

    @Column({ default: false })
    isDomainWhiteListedForCasinoVideos!: boolean;

    @Column({ default: false })
    isDomainWhiteListedForIntCasinoGames!: boolean;

    // URLs
    @Column({ default: "" })
    TechAdminUrl!: string;

    @Column({ default: "" })
    AdminUrl!: string;

    //   @Column({ default: "" })
    //   ClientUrl!: string;

    // @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    // ClientUrls!: string[];

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    ClientUrl!: string[];

    @Column({ default: "" })
    CommonName!: string;

    @Column({ default: "" })
    websiteTitle!: string;

    // Meta Tags (stored as JSON)
    @Column({ type: "json", nullable: true })
    websiteMetaTags!: Record<string, any> | null;

    // Website Theme (client)
    @Column({ default: "#0D7A8E" })
    primaryBackground!: string;

    @Column({ default: "#0D7A8E" })
    primaryBackground90!: string;

    @Column({ default: "#04303e" })
    secondaryBackground!: string;

    @Column({ default: "#AE4600B3" })
    secondaryBackground70!: string;

    @Column({ default: "#AE4600E6" })
    secondaryBackground85!: string;

    @Column({ default: "#FFFFFF" })
    textPrimary!: string;

    @Column({ default: "#CCCCCC" })
    textSecondary!: string;

    // Sports Settings
    @Column("text", { array: true, default: ["Back", "Lay"] })
    matchOdd!: string[];

    // Changed to JSON to support 2D arrays
    @Column({ type: "json", nullable: true })
    matchOddOptions!: string[][];

    @Column("text", { array: true, default: ["Back", "Lay"] })
    bookMakerOdd!: string[];

    @Column("text", { array: true, default: ["No", "Yes"] })
    normalOdd!: string[];

    // Refund Options
    @Column({ type: "boolean", default: false })
    refundOptionIsActive!: boolean;

    @Column({ type: "float", default: 0 })
    refundPercentage!: number;

    @Column({ type: "float", default: 0 })
    refundLimit!: number;

    @Column({ type: "float", default: 100 })
    minDeposit!: number;

    // Website Access Settings
    @Column({ type: "boolean", default: false })
    autoSignUpFeature!: boolean;

    @Column({ type: "text", nullable: true })
    autoSignUpAssignedUplineId!: string | null;

    @Column({ type: "boolean", default: false })
    whatsappNumber!: boolean;

    @Column({ type: "text", default: "" })
    googleAnalyticsTrackingId!: string;

    @Column({ type: "boolean", default: false })
    loginWithDemoIdFeature!: boolean;

    // Status
    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ type: "text", default: "" })
    Logo!: string;

    @Column({ type: "uuid", nullable: true })
    createdById!: string | null;

    // Timestamps
    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

// CREATE TABLE "whitelistsNew"(
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     "isDomainWhiteListedForSportScore" boolean NOT NULL DEFAULT false,
//     "isDomainWhiteListedForSportVideos" boolean NOT NULL DEFAULT false,
//     "isDomainWhiteListedForCasinoVideos" boolean NOT NULL DEFAULT false,
//     "isDomainWhiteListedForIntCasinoGames" boolean NOT NULL DEFAULT false,
//     "TechAdminUrl" text NOT NULL DEFAULT '',
//     "AdminUrl" text NOT NULL DEFAULT '',
//     "ClientUrl" text[] NOT NULL DEFAULT ARRAY[]:: text[],
//     "CommonName" text NOT NULL DEFAULT '',
//     "websiteTitle" text NOT NULL DEFAULT '',
//     "websiteMetaTags" json NULL,
//     "primaryBackground" text NOT NULL DEFAULT '#0D7A8E',
//     "primaryBackground90" text NOT NULL DEFAULT '#0D7A8E',
//     "secondaryBackground" text NOT NULL DEFAULT '#04303e',
//     "secondaryBackground70" text NOT NULL DEFAULT '#AE4600B3',
//     "secondaryBackground85" text NOT NULL DEFAULT '#AE4600E6',
//     "textPrimary" text NOT NULL DEFAULT '#FFFFFF',
//     "textSecondary" text NOT NULL DEFAULT '#CCCCCC',
//     "matchOdd" text[] NOT NULL DEFAULT ARRAY['Back', 'Lay'],
//     "matchOddOptions" json NULL,
//     "bookMakerOdd" text[] NOT NULL DEFAULT ARRAY['Back', 'Lay'],
//     "normalOdd" text[] NOT NULL DEFAULT ARRAY['No', 'Yes'],
//     "refundOptionIsActive" boolean NOT NULL DEFAULT false,
//     "refundPercentage" double precision NOT NULL DEFAULT 0,
//     "refundLimit" double precision NOT NULL DEFAULT 0,
//     "minDeposit" double precision NOT NULL DEFAULT 100,
//     "autoSignUpFeature" boolean NOT NULL DEFAULT false,
//     "autoSignUpAssignedUplineId" text NULL,
//     "whatsappNumber" boolean NOT NULL DEFAULT false,
//     "googleAnalyticsTrackingId" text NOT NULL DEFAULT '',
//     "loginWithDemoIdFeature" boolean NOT NULL DEFAULT false,
//     "isActive" boolean NOT NULL DEFAULT true,
//     "Logo" text NOT NULL DEFAULT '',
//     "createdById" uuid NULL,
//     "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
//     "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
// );

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'whitelist_updated' })
export class Whitelist {

  @PrimaryGeneratedColumn('uuid')
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
  @Column({ default: '' })
  TechAdminUrl!: string;

  @Column({ default: '' })
  AdminUrl!: string;

  // Multiple Client URLs Support - ClientUrl is now an array
  @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
  ClientUrl!: string[];

  @Column({ default: '' })
  CommonName!: string;

  @Column({ default: '' })
  websiteTitle!: string;

  // Meta Tags (stored as JSON)
  @Column({ type: 'json', nullable: true })
  websiteMetaTags!: Record<string, any> | null;

  // Website Theme (client)
  @Column({ default: '#0D7A8E' })
  primaryBackground!: string;

  @Column({ default: '#0D7A8E' })
  primaryBackground90!: string;

  @Column({ default: '#04303e' })
  secondaryBackground!: string;

  @Column({ default: '#AE4600B3' })
  secondaryBackground70!: string;

  @Column({ default: '#AE4600E6' })
  secondaryBackground85!: string;

  @Column({ default: '#FFFFFF' })
  textPrimary!: string;

  @Column({ default: '#CCCCCC' })
  textSecondary!: string;

  // Panel-Specific Settings
  @Column({ type: 'jsonb', nullable: true })
  panelSettings!: {
    // Client Panel Settings
    client?: {
      // Sports Settings
      sports?: {
        matchOdd?: string[];
        matchOddOptions?: string[][];
        bookMakerOdd?: string[];
        normalOdd?: string[];
        refundOptionIsActive?: boolean;
        refundPercentage?: number;
        refundLimit?: number;
        minDeposit?: number;
      };
      // Casino Settings
      casino?: {
        gameTypes?: string[];
        minBet?: number;
        maxBet?: number;
        refundOptionIsActive?: boolean;
        refundPercentage?: number;
        refundLimit?: number;
        minDeposit?: number;
      };
      // Theme Settings
      theme?: {
        primaryBackground?: string;
        primaryBackground90?: string;
        secondaryBackground?: string;
        secondaryBackground70?: string;
        secondaryBackground85?: string;
        textPrimary?: string;
        textSecondary?: string;
      };
    };
    // Admin Panel Settings
    admin?: {
      sports?: {
        matchOdd?: string[];
        matchOddOptions?: string[][];
        bookMakerOdd?: string[];
        normalOdd?: string[];
      };
      casino?: {
        gameTypes?: string[];
        minBet?: number;
        maxBet?: number;
      };
    };
    // TechAdmin Panel Settings
    techAdmin?: {
      sports?: {
        matchOdd?: string[];
        matchOddOptions?: string[][];
        bookMakerOdd?: string[];
        normalOdd?: string[];
      };
      casino?: {
        gameTypes?: string[];
        minBet?: number;
        maxBet?: number;
      };
    };
  } | null;

  // Legacy Sports Settings (for backward compatibility)
  @Column("text", { array: true, default: ['Back', 'Lay'] })
  matchOdd!: string[];

  // Changed to JSON to support 2D arrays
  @Column({ type: 'json', nullable: true })
  matchOddOptions!: string[][];

  @Column("text", { array: true, default: ['Back', 'Lay'] })
  bookMakerOdd!: string[];

  @Column("text", { array: true, default: ['No', 'Yes'] })
  normalOdd!: string[];

  // Refund Options
  @Column({ type: "boolean", default: false })
  refundOptionIsActive!: boolean;

  @Column({ type: 'float', default: 0 })
  refundPercentage!: number;

  @Column({ type: 'float', default: 0 })
  refundLimit!: number;

  @Column({ type: 'float', default: 100 })
  minDeposit!: number;

  // Website Access Settings
  @Column({ type: "boolean", default: false })
  autoSignUpFeature!: boolean;

  @Column({ type: "text", nullable: true })
  autoSignUpAssignedUplineId!: string | null;

  @Column({ type: "boolean", default: false })
  whatsappNumber!: boolean;

  @Column({ type: "text", default: '' })
  googleAnalyticsTrackingId!: string;

  @Column({ type: "boolean", default: false })
  loginWithDemoIdFeature!: boolean;

  // Status
  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "text", default: "" })
  Logo!: string;

  // Payment Gateway Permissions
  @Column({ type: 'jsonb', nullable: true })
  paymentGatewayPermissions!: {
    canCreateGateways?: boolean;
    canManageGateways?: boolean;
    canAssignGateways?: boolean;
    canProcessRequests?: boolean;
  } | null;

  @Column({ type: "uuid", nullable: true })
  createdById!: string | null;

  // Timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Helper Methods
  public getAllClientUrls(): string[] {
    return [...this.ClientUrl]; // ClientUrl is now an array
  }

  public getClientSportsSettings() {
    return this.panelSettings?.client?.sports || {
      matchOdd: this.matchOdd,
      matchOddOptions: this.matchOddOptions,
      bookMakerOdd: this.bookMakerOdd,
      normalOdd: this.normalOdd,
      refundOptionIsActive: this.refundOptionIsActive,
      refundPercentage: this.refundPercentage,
      refundLimit: this.refundLimit,
      minDeposit: this.minDeposit
    };
  }

  public getClientCasinoSettings() {
    return this.panelSettings?.client?.casino || {
      gameTypes: ['teen20', 'poker', 'goal', 'ab3'],
      minBet: 10,
      maxBet: 10000,
      refundOptionIsActive: this.refundOptionIsActive,
      refundPercentage: this.refundPercentage,
      refundLimit: this.refundLimit,
      minDeposit: this.minDeposit
    };
  }

  public getClientThemeSettings() {
    return this.panelSettings?.client?.theme || {
      primaryBackground: this.primaryBackground,
      primaryBackground90: this.primaryBackground90,
      secondaryBackground: this.secondaryBackground,
      secondaryBackground70: this.secondaryBackground70,
      secondaryBackground85: this.secondaryBackground85,
      textPrimary: this.textPrimary,
      textSecondary: this.textSecondary
    };
  }

  public getAdminSportsSettings() {
    return this.panelSettings?.admin?.sports || {
      matchOdd: this.matchOdd,
      matchOddOptions: this.matchOddOptions,
      bookMakerOdd: this.bookMakerOdd,
      normalOdd: this.normalOdd
    };
  }

  public getAdminCasinoSettings() {
    return this.panelSettings?.admin?.casino || {
      gameTypes: ['teen20', 'poker', 'goal', 'ab3'],
      minBet: 10,
      maxBet: 10000
    };
  }

  public getTechAdminSportsSettings() {
    return this.panelSettings?.techAdmin?.sports || {
      matchOdd: this.matchOdd,
      matchOddOptions: this.matchOddOptions,
      bookMakerOdd: this.bookMakerOdd,
      normalOdd: this.normalOdd
    };
  }

  public getTechAdminCasinoSettings() {
    return this.panelSettings?.techAdmin?.casino || {
      gameTypes: ['teen20', 'poker', 'goal', 'ab3'],
      minBet: 10,
      maxBet: 10000
    };
  }

  public isUrlWhitelisted(url: string): boolean {
    const allUrls = this.getAllClientUrls();
    return allUrls.some(whitelistedUrl => 
      url === whitelistedUrl || 
      url.startsWith(whitelistedUrl) ||
      whitelistedUrl.includes(url)
    );
  }

  public getPanelSettingsForUserType(userType: 'client' | 'admin' | 'techAdmin') {
    switch (userType) {
      case 'client':
        return {
          sports: this.getClientSportsSettings(),
          casino: this.getClientCasinoSettings(),
          theme: this.getClientThemeSettings()
        };
      case 'admin':
        return {
          sports: this.getAdminSportsSettings(),
          casino: this.getAdminCasinoSettings()
        };
      case 'techAdmin':
        return {
          sports: this.getTechAdminSportsSettings(),
          casino: this.getTechAdminCasinoSettings()
        };
      default:
        return null;
    }
  }
}

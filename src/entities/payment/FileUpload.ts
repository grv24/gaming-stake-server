import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('fileUpload')
@Index(['uploadType', 'relatedEntityType'])
@Index(['uploadedBy'])
@Index(['createdAt'])
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  fileName!: string; // Original file name

  @Column({ type: 'varchar', length: 500 })
  filePath!: string; // Stored file path

  @Column({ type: 'varchar', length: 100 })
  fileType!: string; // MIME type

  @Column({ type: 'bigint' })
  fileSize!: number; // File size in bytes

  @Column({ 
    type: 'enum', 
    enum: ['gatewayImage', 'qrImage', 'paymentProof']
  })
  uploadType!: 'gatewayImage' | 'qrImage' | 'paymentProof';

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId!: string; // ID of related entity (gateway, deposit request)

  @Column({ type: 'varchar', length: 50, nullable: true })
  relatedEntityType!: string; // Type of related entity ('PaymentGateway', 'DepositRequest')

  @Column({ type: 'uuid' })
  uploadedBy!: string; // User who uploaded the file

  @Column({ type: 'varchar', length: 50 })
  uploadedByType!: string; // Type of user who uploaded

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupId!: string; // Group identifier for multi-tenant support

  @Column({ type: 'boolean', default: true })
  isActive!: boolean; // Soft delete flag

  @CreateDateColumn()
  createdAt!: Date;

  // Helper methods
  public getFileExtension(): string {
    const parts = this.fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  public getFileSizeInMB(): number {
    return this.fileSize / (1024 * 1024);
  }

  public getFileSizeInKB(): number {
    return this.fileSize / 1024;
  }

  public isImageFile(): boolean {
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    return imageTypes.includes(this.getFileExtension());
  }

  public getPublicUrl(): string {
    // This would be configured based on your file serving setup
    return `/uploads/${this.filePath}`;
  }

  public getFullPath(): string {
    // This would be configured based on your file storage setup
    return `${process.env.UPLOAD_PATH || './uploads'}/${this.filePath}`;
  }

  public softDelete(): void {
    this.isActive = false;
  }

  public restore(): void {
    this.isActive = true;
  }

  public isDeleted(): boolean {
    return !this.isActive;
  }

  public getDisplayName(): string {
    return this.fileName;
  }

  public getUploadTypeDisplay(): string {
    switch (this.uploadType) {
      case 'gatewayImage':
        return 'Gateway Image';
      case 'qrImage':
        return 'QR Code';
      case 'paymentProof':
        return 'Payment Proof';
      default:
        return this.uploadType;
    }
  }
}


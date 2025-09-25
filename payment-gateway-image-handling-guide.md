# Payment Gateway Image Handling System

## Overview
This system handles image uploads for payment gateways with a proper public directory structure and URL serving.

## Directory Structure
```
public/
└── images/
    └── payment-gateways/
        ├── gateway-images/     # Gateway logos/images
        ├── qr-codes/          # QR code images
        └── payment-proofs/    # Payment proof images
```

## Features

### 1. Organized File Storage
- **Gateway Images**: Stored in `public/images/payment-gateways/gateway-images/`
- **QR Codes**: Stored in `public/images/payment-gateways/qr-codes/`
- **Payment Proofs**: Stored in `public/images/payment-gateways/payment-proofs/`

### 2. Public URL Serving
- Files are accessible via public URLs like `/images/payment-gateways/gateway-images/filename.jpg`
- Express static middleware serves files from the public directory
- URLs are stored in the database for easy access

### 3. File Naming Convention
- Format: `{fieldname}-{timestamp}-{random}-{sanitized-original-name}`
- Example: `gatewayImage-1695567890123-456789123-upi_logo.jpg`
- Special characters in original names are replaced with underscores

### 4. File Validation
- **Allowed Types**: JPEG, JPG, PNG, GIF, PDF (for payment proofs)
- **Size Limit**: 5MB per file
- **Security**: File type validation by extension and MIME type

## API Endpoints

### Create Payment Gateway with Images
```
POST /api/v1/payment/createpaymentgateway
Content-Type: multipart/form-data

Fields:
- gatewayMethod: string
- gatewayDetails: JSON string
- gatewayImage: file (optional)
- qrImage: file (optional)
```

### Update Payment Gateway with Images
```
PATCH /api/v1/payment/updatepaymentgateway/:id
Content-Type: multipart/form-data

Fields:
- gatewayMethod: string (optional)
- gatewayDetails: JSON string (optional)
- gatewayImage: file (optional)
- qrImage: file (optional)
```

### Create Deposit Request with Payment Proof
```
POST /api/v1/payment/createdepositrequest
Content-Type: multipart/form-data

Fields:
- transactionNo: string
- amount: number
- gatewayId: string
- paymentProof: file (optional)
```

## Database Schema

### FileUpload Entity
```typescript
{
  id: string (UUID)
  fileName: string (original filename)
  filePath: string (stored file path)
  publicUrl: string (public URL for serving)
  fileType: string (MIME type)
  fileSize: number (bytes)
  uploadType: 'gatewayImage' | 'qrImage' | 'paymentProof'
  relatedEntityId: string (UUID of related entity)
  relatedEntityType: string ('PaymentGateway' | 'DepositRequest')
  uploadedBy: string (UUID of user)
  uploadedByType: string (user type)
  groupId: string (group identifier)
  isActive: boolean
  createdAt: Date
}
```

### PaymentGateway Entity
```typescript
{
  id: string (UUID)
  gatewayMethod: string
  gatewayImage: string (public URL)
  qrImage: string (public URL)
  gatewayDetails: object (JSONB)
  isActive: boolean
  createdBy: string (UUID)
  createdByType: string
  groupId: string
  createdAt: Date
  updatedAt: Date
}
```

## Usage Examples

### Frontend Integration
```javascript
// Upload form
const formData = new FormData();
formData.append('gatewayMethod', 'UPI');
formData.append('gatewayDetails', JSON.stringify({
  upiId: 'example@paytm',
  accountName: 'Test Account'
}));
formData.append('gatewayImage', fileInput.files[0]);
formData.append('qrImage', qrFileInput.files[0]);

fetch('/api/v1/payment/createpaymentgateway', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

### Display Images
```html
<!-- Gateway image -->
<img src="/images/payment-gateways/gateway-images/gatewayImage-1695567890123-456789123-upi_logo.jpg" 
     alt="Gateway Logo" />

<!-- QR code -->
<img src="/images/payment-gateways/qr-codes/qrImage-1695567890123-456789123-qr_code.png" 
     alt="QR Code" />

<!-- Payment proof -->
<img src="/images/payment-gateways/payment-proofs/paymentProof-1695567890123-456789123-proof.jpg" 
     alt="Payment Proof" />
```

## Migration

### Add publicUrl Column
Run the SQL migration to add the `publicUrl` column:
```sql
ALTER TABLE "fileUpload" 
ADD COLUMN IF NOT EXISTS "publicUrl" varchar(500) DEFAULT NULL;
```

## Security Considerations

1. **File Type Validation**: Only allowed image types are accepted
2. **Size Limits**: 5MB maximum file size
3. **Path Sanitization**: Special characters in filenames are sanitized
4. **Directory Structure**: Organized subdirectories prevent file conflicts
5. **Public Access**: Files are served publicly, ensure sensitive data isn't included

## Error Handling

- **File Too Large**: Returns 413 status with error message
- **Invalid File Type**: Returns 400 status with error message
- **Upload Failure**: Returns 500 status with error details
- **Missing Files**: Gracefully handles optional file uploads

## Performance

- **Static Serving**: Express static middleware for efficient file serving
- **File Organization**: Subdirectories prevent large directory listings
- **Unique Naming**: Timestamp + random prevents filename conflicts
- **Database Indexing**: Indexes on uploadType and relatedEntityType for fast queries






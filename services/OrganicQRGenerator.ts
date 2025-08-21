// services/OrganicQRGenerator.ts - Generate organic QR codes using ESC/POS commands

export interface OrganicQROptions {
  moduleSize?: number;
  cornerRadius?: number;
  borderSize?: number;
  organicFactor?: number;
  finderStyle?: 'organic' | 'rounded' | 'square';
}

export class OrganicQRGenerator {
  private readonly ESC = '\x1B';
  private readonly GS = '\x1D';

  /**
   * Generate organic QR code using ESC/POS raster commands
   */
  generateOrganicQRCode(qrCodeData: string, options: OrganicQROptions = {}): string {
    const opts = {
      moduleSize: 6,
      cornerRadius: 3,
      borderSize: 8,
      organicFactor: 1.4,
      finderStyle: 'organic' as const,
      ...options
    };

    // Enhanced QR code parameters for organic appearance
    const modelCommand = this.GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
    const sizeCommand = this.GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(opts.moduleSize);
    const errorCommand = this.GS + '(k' + '\x03\x00' + '\x31\x45' + '\x32'; // High error correction for organic style

    // Store QR code data
    const dataLength = qrCodeData.length + 3;
    const storeCommand = this.GS + '(k' + 
      String.fromCharCode(dataLength & 0xFF) + 
      String.fromCharCode((dataLength >> 8) & 0xFF) + 
      '\x31\x50\x30' + qrCodeData;

    // Generate organic raster bitmap instead of standard QR
    const organicBitmap = this.generateOrganicQRBitmap(qrCodeData, opts);
    
    return '\n' + this.centerAlign() + 
           modelCommand + 
           sizeCommand + 
           errorCommand + 
           storeCommand + 
           organicBitmap + 
           '\n\n' + 
           this.leftAlign();
  }

  /**
   * Generate organic QR bitmap using raster graphics commands
   */
  private generateOrganicQRBitmap(data: string, options: OrganicQROptions): string {
    // Create a virtual QR code matrix first
    const qrMatrix = this.generateQRMatrix(data);
    const organicMatrix = this.applyOrganicStyling(qrMatrix, options);
    
    // Convert to ESC/POS raster commands
    return this.matrixToRasterCommands(organicMatrix);
  }

  /**
   * Generate basic QR matrix (simplified - in real implementation, use a QR library)
   */
  private generateQRMatrix(data: string): boolean[][] {
    // This is a simplified placeholder - in real implementation, 
    // you'd use a QR code library to generate the boolean matrix
    const size = 25; // Typical QR code size for short data
    const matrix: boolean[][] = [];
    
    // Initialize with basic pattern for demonstration
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        // Simple pattern based on data hash for demo
        const hash = this.simpleHash(data + i + j);
        matrix[i][j] = hash % 3 === 0;
      }
    }
    
    // Add finder patterns
    this.addFinderPatterns(matrix);
    
    return matrix;
  }

  /**
   * Apply organic styling to QR matrix
   */
  private applyOrganicStyling(matrix: boolean[][], options: OrganicQROptions): boolean[][] {
    const size = matrix.length;
    const organicMatrix: boolean[][] = [];
    const { cornerRadius = 3, organicFactor = 1.4 } = options;
    
    // Scale up for organic curves
    const scaledSize = Math.floor(size * organicFactor);
    
    for (let i = 0; i < scaledSize; i++) {
      organicMatrix[i] = [];
      for (let j = 0; j < scaledSize; j++) {
        // Map back to original matrix
        const origI = Math.floor(i / organicFactor);
        const origJ = Math.floor(j / organicFactor);
        
        if (origI >= size || origJ >= size) {
          organicMatrix[i][j] = false;
          continue;
        }
        
        const isModuleDark = matrix[origI][origJ];
        
        if (!isModuleDark) {
          organicMatrix[i][j] = false;
          continue;
        }
        
        // Apply organic rounding
        const shouldBeRounded = this.shouldApplyOrganicRounding(
          matrix, origI, origJ, i % organicFactor, j % organicFactor, cornerRadius
        );
        
        organicMatrix[i][j] = shouldBeRounded;
      }
    }
    
    return organicMatrix;
  }

  /**
   * Determine if a pixel should be rounded based on organic algorithm
   */
  private shouldApplyOrganicRounding(
    matrix: boolean[][], 
    moduleI: number, 
    moduleJ: number, 
    pixelI: number, 
    pixelJ: number, 
    cornerRadius: number
  ): boolean {
    const neighbors = this.getNeighbors(matrix, moduleI, moduleJ);
    const connectedSides = neighbors.filter(Boolean).length;
    
    // Calculate organic corner radius based on connectivity
    let organicRadius: number;
    switch (connectedSides) {
      case 0: organicRadius = cornerRadius * 2.0; break;   // Isolated = very round
      case 1: organicRadius = cornerRadius * 1.6; break;   // End piece = round
      case 2: organicRadius = cornerRadius * 1.3; break;   // Corner = medium round
      case 3: organicRadius = cornerRadius * 1.0; break;   // Junction = slight round
      default: organicRadius = cornerRadius * 0.7; break; // Connected = minimal round
    }
    
    // Check if current pixel is within organic rounded corner
    const centerX = organicRadius;
    const centerY = organicRadius;
    const distanceFromCenter = Math.sqrt(
      Math.pow(pixelI - centerX, 2) + Math.pow(pixelJ - centerY, 2)
    );
    
    // Apply organic smoothing curve
    const organicCurve = Math.pow(distanceFromCenter / organicRadius, 0.8);
    
    return organicCurve <= 1.0;
  }

  /**
   * Get neighboring modules for organic calculation
   */
  private getNeighbors(matrix: boolean[][], i: number, j: number): boolean[] {
    const size = matrix.length;
    return [
      i > 0 ? matrix[i - 1][j] : false,        // top
      j < size - 1 ? matrix[i][j + 1] : false, // right
      i < size - 1 ? matrix[i + 1][j] : false, // bottom
      j > 0 ? matrix[i][j - 1] : false,        // left
    ];
  }

  /**
   * Add organic finder patterns to matrix
   */
  private addFinderPatterns(matrix: boolean[][]): void {
    const size = matrix.length;
    const finderPositions = [
      [0, 0],                    // Top-left
      [0, size - 7],            // Top-right
      [size - 7, 0]             // Bottom-left
    ];
    
    finderPositions.forEach(([startI, startJ]) => {
      this.drawOrganicFinderPattern(matrix, startI, startJ);
    });
  }

  /**
   * Draw organic finder pattern (7x7 with rounded corners)
   */
  private drawOrganicFinderPattern(matrix: boolean[][], startI: number, startJ: number): void {
    // Outer 7x7 square with organic corners
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const globalI = startI + i;
        const globalJ = startJ + j;
        
        if (globalI >= matrix.length || globalJ >= matrix[0].length) continue;
        
        // Create organic finder pattern
        const isEdge = i === 0 || i === 6 || j === 0 || j === 6;
        const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        const isWhiteRing = !isEdge && !isInner;
        
        if (isEdge || isInner) {
          // Apply organic rounding to corners
          const isCorner = (i <= 1 || i >= 5) && (j <= 1 || j >= 5);
          
          if (isCorner) {
            // Calculate organic corner distance
            const cornerI = i <= 1 ? i : 6 - i;
            const cornerJ = j <= 1 ? j : 6 - j;
            const cornerDistance = Math.sqrt(cornerI * cornerI + cornerJ * cornerJ);
            
            // Apply organic curve to corners
            matrix[globalI][globalJ] = cornerDistance <= 1.8; // Organic threshold
          } else {
            matrix[globalI][globalJ] = true;
          }
        } else {
          matrix[globalI][globalJ] = false; // White ring
        }
      }
    }
  }

  /**
   * Convert boolean matrix to ESC/POS raster commands
   */
  private matrixToRasterCommands(matrix: boolean[][]): string {
    const height = matrix.length;
    const width = matrix[0]?.length || 0;
    
    if (height === 0 || width === 0) return '';
    
    // Calculate bytes per line (must be even)
    const bytesPerLine = Math.ceil(width / 8);
    const paddedBytesPerLine = bytesPerLine % 2 === 0 ? bytesPerLine : bytesPerLine + 1;
    
    // ESC/POS raster bit image command
    let rasterData = this.ESC + '*' + '\x21'; // 24-dot double-density
    rasterData += String.fromCharCode(paddedBytesPerLine & 0xFF);
    rasterData += String.fromCharCode((paddedBytesPerLine >> 8) & 0xFF);
    
    // Convert matrix to bitmap bytes
    for (let row = 0; row < height; row++) {
      let byteIndex = 0;
      let currentByte = 0;
      let bitPosition = 7;
      
      for (let col = 0; col < width; col++) {
        if (matrix[row][col]) {
          currentByte |= (1 << bitPosition);
        }
        
        bitPosition--;
        
        if (bitPosition < 0 || col === width - 1) {
          rasterData += String.fromCharCode(currentByte);
          currentByte = 0;
          bitPosition = 7;
          byteIndex++;
        }
      }
      
      // Pad to even number of bytes
      while (byteIndex < paddedBytesPerLine) {
        rasterData += '\x00';
        byteIndex++;
      }
      
      rasterData += '\n'; // Line feed after each row
    }
    
    return rasterData;
  }

  /**
   * Simple hash function for demo QR pattern
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Center alignment command
   */
  private centerAlign(): string {
    return this.ESC + 'a' + '\x01';
  }

  /**
   * Left alignment command
   */
  private leftAlign(): string {
    return this.ESC + 'a' + '\x00';
  }

  /**
   * Generate enhanced organic QR with better spacing
   */
  generateEnhancedOrganicQR(qrCodeData: string, options: OrganicQROptions = {}): string {
    const organicQR = this.generateOrganicQRCode(qrCodeData, options);
    
    return '\n' +
           this.centerAlign() +
           '================================\n' +
           organicQR +
           '================================\n' +
           this.leftAlign();
  }

  /**
   * Generate organic QR with GLT branding style
   */
  generateGLTStyleQR(packageCode: string, trackingUrl: string): string {
    const options: OrganicQROptions = {
      moduleSize: 8,        // Larger for better scanning
      cornerRadius: 4,      // Nice organic curves
      borderSize: 12,       // Good border
      organicFactor: 1.5,   // Enhanced organic appearance
      finderStyle: 'organic'
    };
    
    return this.generateEnhancedOrganicQR(trackingUrl, options);
  }
}
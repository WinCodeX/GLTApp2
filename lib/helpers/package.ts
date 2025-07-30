import axios from 'axios';
import { API_BASE_URL } from './config'; // Use your base API URL

// Define package data type
type PackageData = {
  receiverName: string;
  receiverPhone: string;
  originAgent: any; // Or use a more specific type (Agent type)
  destinationAgent: any; // Or use a more specific type (Agent type)
  originArea: any; // Or use a more specific type (Area type)
  destinationArea: any; // Or use a more specific type (Area type)
  deliveryType: 'doorstep' | 'agent' | 'mixed';
  cost: number;
};

// Create Package function
export const createPackage = async (packageData: PackageData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/packages`, {
      package: packageData,
    });

    // If the response is successful, return the package data
    return response.data;
  } catch (error) {
    // Handle errors, you can customize the error message
    if (error.response) {
      throw new Error(`Error: ${error.response.data.errors.join(', ')}`);
    } else {
      throw new Error('Network Error');
    }
  }
};
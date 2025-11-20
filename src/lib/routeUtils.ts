/**
 * Maps old route names to new Route 1, 2, 3 format
 * This ensures consistent display across the application
 */
export const mapRouteName = (routeName: string): string => {
  if (routeName === 'Rajkot - Jamnagar') {
    return 'Route 1';
  } else if (routeName === 'Ahmedabad - Vadodara') {
    return 'Route 2';
  } else if (routeName === 'Gandhinagar - Mehsana') {
    return 'Route 3';
  } else if (routeName === 'Surat - Navsari') {
    // This route should be hidden/filtered out
    return '';
  }
  
  // Return original name for any other routes (including new Route X format)
  return routeName;
};

/**
 * Checks if a route should be displayed (filters out hidden routes)
 */
export const shouldDisplayRoute = (routeName: string): boolean => {
  return routeName !== 'Surat - Navsari';
};

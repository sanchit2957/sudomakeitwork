export function hasValidHospitalCapacity(
  totalEmergencyBeds: number,
  availableEmergencyBeds: number,
  totalIcuBeds: number,
  availableIcuBeds: number,
) {
  return (
    totalEmergencyBeds >= 0 &&
    availableEmergencyBeds >= 0 &&
    availableEmergencyBeds <= totalEmergencyBeds &&
    totalIcuBeds >= 0 &&
    availableIcuBeds >= 0 &&
    availableIcuBeds <= totalIcuBeds
  );
}


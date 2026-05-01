/**
 * Emergency Profile Data Filtering
 * Filters profile data based on access level (public, OTP-protected, full)
 */

import type { ProfileDocument } from '@/../../packages/db/profiles';

export interface PublicEmergencyProfile {
  id: string;
  patient: {
    name: string;
    age?: number;
    dateOfBirth?: string; // YYYY-MM-DD only
    gender?: string;
    bloodGroup?: string;
    bloodGroupEmoji?: string;
  };
  allergies: {
    list: string[];
    severity: string[];
    description?: string;
  };
  medicalConditions: {
    activeConditions: Array<{
      condition: string;
      diagnosed?: string;
      status?: string;
    }>;
  };
  medications: {
    current: string[];
    note?: string;
  };
  healthSummary?: {
    overallStatus: string;
    keyFindings: string[];
    alert?: string | null;
  };
  insurance: {
    hasInsurance: boolean;
    insurerName?: string;
    policyType?: string;
    policyNumberHidden: boolean;
    estimatedCoverage?: string;
    contactButtonText?: string;
  };
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  vaccinations?: {
    lastUpdated?: string;
    summary?: string;
  };
  doctorNotes?: string;
}

export interface FullEmergencyProfile extends PublicEmergencyProfile {
  medicalHistory: {
    recentDiagnoses: Array<{
      diagnosis: string;
      diagnosedDate?: string;
      severity?: string;
      status?: string;
    }>;
    pastSurgeries: Array<{
      procedure: string;
      date?: string;
      hospital?: string;
      notes?: string;
    }>;
    pastHospitalizations: Array<{
      reason: string;
      dates?: string;
      hospital?: string;
    }>;
  };
  labResults: {
    recent: Array<{
      testName: string;
      testDate?: string;
      value: number;
      unit: string;
      referenceRange?: string;
      status?: string;
      interpretation?: string;
    }>;
  };
  medications: {
    current: Array<{
      name: string;
      dosage: string;
      frequency: string;
      startDate?: string;
      indication?: string;
      sideEffects?: string[];
    }>;
    previousMedications?: Array<{
      name: string;
      dosage?: string;
      reason?: string;
    }>;
  };
  allergies: {
    detailed: Array<{
      allergen: string;
      severity: string;
      reactionType: string;
      dateDiscovered?: string;
      alternativeClass?: string;
      notes?: string;
    }>;
  };
  insurance: {
    provider: string;
    policyNumber: string;
    policyType: string;
    coverageAmount?: string;
    sumInsured?: string;
    claimHistory?: string;
    documentUrl?: string;
  };
  vaccinations: {
    lastUpdated?: string;
    records: Array<{
      vaccine: string;
      doses?: string[];
      status?: string;
    }>;
  };
  recentDocuments?: Array<{
    docName: string;
    type: string;
    uploadDate?: string;
    url?: string;
  }>;
  doctorNotes?: Array<{
    doctorName?: string;
    date?: string;
    note: string;
  }>;
}

/**
 * Filter profile data to public-only access level
 */
export function filterToPublicProfile(
  profile: any,
  userVitals?: any,
  healthSummary?: any
): PublicEmergencyProfile {
  // Calculate age if DOB available
  let age: number | undefined;
  if (profile.dateOfBirth) {
    const today = new Date();
    age = today.getFullYear() - new Date(profile.dateOfBirth).getFullYear();
  }

  // Get blood group emoji
  const bloodGroupEmoji = getBloodGroupEmoji(profile.bloodGroup);

  return {
    id: profile.id,
    patient: {
      name: profile.displayName || profile.userId,
      age,
      dateOfBirth: profile.dateOfBirth
        ? new Date(profile.dateOfBirth).toISOString().split('T')[0]
        : undefined,
      gender: profile.gender,
      bloodGroup: profile.bloodGroup,
      bloodGroupEmoji,
    },
    allergies: {
      list: profile.allergies || [],
      severity: (profile.allergies || []).map(() => 'High'), // Default severity
      description:
        profile.allergies && profile.allergies.length > 0
          ? `⚠️ CRITICAL: ${profile.allergies.join(', ')}`
          : undefined,
    },
    medicalConditions: {
      activeConditions: (profile.conditions || []).map((condition: string) => ({
        condition,
        status: 'Active',
      })),
    },
    medications: {
      current: extractCurrentMedications(userVitals),
      note: 'Generic medication information - confirm with doctor before administration',
    },
    healthSummary: healthSummary
      ? {
          overallStatus:
            healthSummary.summary_ai || 'Stable - Refer to full medical records for details',
          keyFindings: extractKeyFindings(healthSummary),
          alert: healthSummary.alert || null,
        }
      : undefined,
    insurance: {
      hasInsurance: !!profile.insurance,
      insurerName: profile.insurance?.provider,
      policyType: profile.insurance?.type,
      policyNumberHidden: true, // Never show in public
      estimatedCoverage: profile.insurance?.coverage,
      contactButtonText: 'Contact Insurance',
    },
    emergencyContacts: (profile.emergencyData?.contacts || []).map((contact: any) => ({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
    })),
    vaccinations: healthSummary
      ? {
          lastUpdated: new Date().toISOString().split('T')[0],
          summary: 'View full vaccination records after verification',
        }
      : undefined,
    doctorNotes: profile.emergencyData?.notes,
  };
}

/**
 * Filter profile data to full access level
 * (after OTP verification or pre-auth doctor)
 */
export function filterToFullProfile(
  profile: any,
  userVitals?: any,
  healthSummary?: any,
  labResults?: any,
  documents?: any[]
): FullEmergencyProfile {
  const publicProfile = filterToPublicProfile(profile, userVitals, healthSummary);

  return {
    ...publicProfile,
    medicalHistory: {
      recentDiagnoses: (userVitals?.conditions || []).map((condition: any) => ({
        diagnosis: condition.name || condition,
        severity: condition.severity,
        status: condition.status || 'Active',
      })),
      pastSurgeries: extractPastSurgeries(userVitals),
      pastHospitalizations: extractPastHospitalizations(userVitals),
    },
    labResults: {
      recent: (labResults || []).slice(0, 10).map((result: any) => ({
        testName: result.testName,
        testDate: result.date,
        value: result.value,
        unit: result.unit,
        referenceRange: result.referenceRange,
        status: result.status,
        interpretation: result.interpretation,
      })),
    },
    medications: {
      current: (userVitals?.medications || []).map((med: any) => ({
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        startDate: med.startDate,
        indication: med.indication,
        sideEffects: med.sideEffects || [],
      })),
      previousMedications: (userVitals?.previousMedications || []).map((med: any) => ({
        name: med.name,
        dosage: med.dosage,
        reason: med.reason,
      })),
    },
    allergies: {
      ...publicProfile.allergies,
      detailed: (profile.allergies || []).map((allergen: string) => ({
        allergen,
        severity: 'Severe',
        reactionType: 'Unknown - refer to full records',
        alternativeClass: 'Consult doctor for alternatives',
      })),
    },
    insurance: {
      provider: profile.insurance?.provider || 'Unknown',
      policyNumber: profile.insurance?.policyNumber || 'HIDDEN',
      policyType: profile.insurance?.type || 'Unknown',
      coverageAmount: profile.insurance?.coverage,
      claimHistory: profile.insurance?.claimHistory,
      documentUrl: profile.insurance?.documentUrl,
    },
    vaccinations: {
      lastUpdated: new Date().toISOString().split('T')[0],
      records: (userVitals?.vaccinations || []).map((vac: any) => ({
        vaccine: vac.name,
        doses: vac.doses,
        status: vac.status,
      })),
    },
    recentDocuments: (documents || []).slice(0, 5).map((doc: any) => ({
      docName: doc.name,
      type: doc.type,
      uploadDate: doc.uploadDate,
      url: doc.url,
    })),
    doctorNotes: extractDoctorNotes(healthSummary),
  };
}

/**
 * Get blood group emoji
 */
function getBloodGroupEmoji(bloodGroup?: string): string | undefined {
  return bloodGroup ? '🩸' : undefined;
}

/**
 * Extract current medications from vitals
 */
function extractCurrentMedications(userVitals?: any): string[] {
  if (!userVitals?.medications) {
    return [];
  }

  return userVitals.medications
    .filter((m: any) => m.status !== 'discontinued')
    .map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`.trim());
}

/**
 * Extract key findings from health summary
 */
function extractKeyFindings(healthSummary?: any): string[] {
  if (!healthSummary) {
    return [];
  }

  const findings: string[] = [];

  if (healthSummary.summary_ai) {
    findings.push(healthSummary.summary_ai);
  }

  if (healthSummary.keyPoints) {
    findings.push(...healthSummary.keyPoints.split('\n').filter((p: string) => p.trim()));
  }

  return findings.slice(0, 5); // Limit to 5 key findings
}

/**
 * Extract past surgeries
 */
function extractPastSurgeries(userVitals?: any): any[] {
  if (!userVitals?.surgeries) {
    return [];
  }

  return userVitals.surgeries.map((surgery: any) => ({
    procedure: surgery.name,
    date: surgery.date,
    hospital: surgery.hospital,
    notes: surgery.notes,
  }));
}

/**
 * Extract past hospitalizations
 */
function extractPastHospitalizations(userVitals?: any): any[] {
  if (!userVitals?.hospitalizations) {
    return [];
  }

  return userVitals.hospitalizations.map((hosp: any) => ({
    reason: hosp.reason,
    dates: hosp.dates,
    hospital: hosp.hospital,
  }));
}

/**
 * Extract doctor notes
 */
function extractDoctorNotes(healthSummary?: any): Array<{ doctorName?: string; date?: string; note: string }> {
  if (!healthSummary?.doctorNotes) {
    return [];
  }

  if (Array.isArray(healthSummary.doctorNotes)) {
    return healthSummary.doctorNotes;
  }

  return [
    {
      note: healthSummary.doctorNotes,
      date: new Date().toISOString().split('T')[0],
    },
  ];
}

/**
 * Get fields accessed for audit log
 */
export function getAccessedFields(profile: PublicEmergencyProfile): string[] {
  const fields: string[] = [
    'name',
    'age',
    'dateOfBirth',
    'gender',
    'bloodGroup',
    'allergies',
    'conditions',
    'medications',
  ];

  if (profile.healthSummary) {
    fields.push('healthSummary');
  }

  if (profile.insurance.hasInsurance) {
    fields.push('insuranceProvider');
  }

  if (profile.emergencyContacts.length > 0) {
    fields.push('emergencyContacts');
  }

  return fields;
}

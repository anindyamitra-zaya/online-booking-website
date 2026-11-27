import type { ClinicBundleConfig } from '../../types/clinic';

export const heartVascularConfig: ClinicBundleConfig = {
  clinic: {
    id: 'heart-vascular',
    name: 'Central Heart & Vascular Clinic',
    shortName: 'Central Heart',
    specialty: 'Cardiology, Echocardiography & Preventive Vascular Care',
    phone: '(512) 555-0240',
    supportEmail: 'scheduling@centralheart.example',
    cancellationPolicyHours: 24,
    bannerImage: '/src/assets/images/clinic_atrium_interior.webp',
    themeColor: '#1d4ed8',
    brandAccent: 'blue',
    reschedulePolicy: {
      lockProvider: true,
      lockLocation: true,
    },
    accommodations: [
      'Wheelchair & mobility assistance',
      'ASL sign language interpreter',
      'Large-print intake forms',
      'Hearing loop equipped check-in',
    ],
    commonVisitReasons: {
      default: [
        'Blood pressure review',
        'Chest tightness or palpitations',
        'Medication refill or adjustment',
        'Echocardiogram / ECG follow-up',
        'Preventive heart check',
      ],
      byAppointmentType: {
        'type-echo': [
          'Routine echocardiogram evaluation',
          'Chest discomfort or shortness of breath',
          'Heart murmur / valve follow-up',
          'Pre-procedure cardiac clearance',
          'Palpitations or rhythm review',
        ],
      },
    },
    cancellationReasons: [
      'Schedule conflict',
      'Symptoms improved / no longer needed',
      'Need a different provider or location',
      'Transportation or travel issue',
      'Other reason',
    ],
    samplePatients: [
      {
        label: 'Established: Elena Vance',
        fullName: 'Elena Vance',
        firstName: 'Elena',
        lastName: 'Vance',
        dateOfBirth: '1984-05-14',
      },
      {
        label: 'New Patient: Jordan Taylor',
        fullName: 'Jordan Taylor',
        firstName: 'Jordan',
        lastName: 'Taylor',
        dateOfBirth: '1990-03-12',
      },
    ],
    locations: [
      {
        id: 'loc-midtown-heart',
        name: 'Midtown Cardiology Center',
        address: '3100 Red River St, Suite 400',
        cityStateZip: 'Austin, TX 78705',
        phone: '(512) 555-0240',
        hours: 'Mon–Fri 8:00 AM – 5:00 PM',
        parkingNote: 'Validated ground-floor garage parking adjacent to lobby',
        accessibilityFeatures: [
          'Step-free elevator access',
          'Accessible stress & echo labs',
          'Hearing loop at reception desk',
        ],
      },
    ],
  },
  providers: [
    {
      id: 'prov-bennett',
      name: 'Dr. Clara Bennett',
      credentials: 'MD, FACC',
      specialty: 'Non-Invasive Cardiology',
      bio: 'Focuses on preventive cardiology, hypertension, and lipid management.',
      languages: ['English'],
      locationIds: ['loc-midtown-heart'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-19',
    },
    {
      id: 'prov-okafor',
      name: 'Dr. Samuel Okafor',
      credentials: 'MD, FACC',
      specialty: 'Electrophysiology & Rhythm Care',
      bio: 'Specializes in arrhythmia evaluation, pacemaker follow-ups, and atrial fibrillation care.',
      languages: ['English', 'French'],
      locationIds: ['loc-midtown-heart'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-20',
    },
  ],
  appointmentTypes: [
    {
      id: 'type-followup',
      name: 'Cardiology Follow-Up Visit',
      durationMinutes: 30,
      description:
        'Medication check, blood pressure review, and ongoing cardiac wellness planning.',
      telehealthAvailable: true,
      preparationInstructions: [
        'Bring your home blood pressure log and current medication list.',
      ],
    },
    {
      id: 'type-echo',
      name: 'Echocardiogram & ECG Evaluation',
      durationMinutes: 45,
      description:
        'In-clinic cardiac ultrasound and 12-lead ECG diagnostic testing.',
      telehealthAvailable: false,
      preparationInstructions: [
        'Wear a comfortable two-piece outfit and avoid lotions on the chest.',
      ],
    },
  ],
};

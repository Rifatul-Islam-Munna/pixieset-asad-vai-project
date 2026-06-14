export enum UserType {
  ADMIN = 'admin',
  EDITOR = 'editor',
  USER = 'user',
}

export interface Address {
  presentAddress: string;
  permanentAddress: string;
  district: string;
  upazila: string;
  extraInfo: string;
}

export interface EducationInfo {
  educationMethod: string;
  highestEducation: string;
  highestEducationBoard: string;
  highestEducationGroup: string;
  highestEducationPassingYear: string;
  currentlyDoingHightEducation: boolean;
  sSCPassingYear: string;
  sSCPassingGroup: string;
  sSCResult: string;
  hSCPassingYear: string;
  hSCPassingGroup: string;
  hSCResult: string;
  educationBackground?:string
}

export interface FamilyInfo {
  isFatherAlive: boolean;
  fathersProfession: string;
  isMotherAlive: boolean;
  mothersProfession: string;
  brotherCount: number;
  brotherInformation: string;
  sisterCount: number;
  sisterInformation: string;
  familyFinancial: string;
  familyAssetDetails: string;
  familyReligiousCondition: string;
}

export interface PersonalInformation {
  outsideClothes: string;
  womenNiqbYear: string;
  manBeard: string;
  manClothAboveAnkels: boolean;
  prayerFiverTimeFrom: string;
  MissPrayerTime: string;
  maharaNonMahram: string;
  reciteQuran: string;
  fiqhFollow: string;
  digitalMedia: string;
  mentalOrPhysicalIssue: string;
  specialWorkOfDeen: string;
  majarBeliveStatus: string;
  islamicBookName: string;
  islamicScholarsName: string;
  extraInfoHobby: string;
  height: number;
  skinTone: string;
  islamicStudy: string;
  physicalStructure: string;
}

export interface Occupational {
  profession: string;
  workingDetails: string;
  salary: string;
}

export interface MarriageInformationWomen {
  isGuardiansAgreed: boolean;
  jobAfterMarriage: string;
  studyAfterMarriage: string;
  thoughtsOnMarriage: string;

  //new value
  polygamyConsentOptions: string;
  caringforChildren: string;
  childCustody: string;
}

export interface MarriageInformationMan {
  isGuardiansAgreed: boolean;
  wifeVailAfterMarriage: string;
  allowWifeStudyAfterMarriage: string;
  wifeJobAfterMarriage: string;
  livingPlaceAfterMarriage: string;
  expectedAnyGiftFromMarriage: string;
  thoughtsOnMarriage: string;
}

export interface ExpectedLifePartner {
  age: string;
  complexion: string;
  height: string;
  education: string;
  district: string;
  upazila: string;
  maritalStatus: string;
  profession: string;
  financialCondition: string;
  expectedQuality: string;
}

export interface Pledge {
  youGordianKnowsThis: boolean;
  allTheInformationTrue: boolean;
  anyMisInformationWeAreNotKnowing: boolean;
}

export interface User {
  _id?: string;
  name: string;
  isPublished?: boolean;
  isPublishFromAdmin?: boolean;
  userId?: string;
  role: UserType;
  email?: string;
  phoneNumber: string;
  whatsapp?: string;
  password: string;
  gender?: string;
  maritalStatus?: string;
  age?: number;
  bloodGroup?: string;
  weight?: number;
  nationality?: string;
  isOtpVerified?: boolean;
  otpNumber?: string;
  otpValidatedAt?: Date;
  isSubscriber?: boolean;
  address?: Address;
  educationInfo?: EducationInfo;
  familyInfo?: FamilyInfo;
  personalInformation?: PersonalInformation;
  occupational?: Occupational;
  marriageInformationWomen?: MarriageInformationWomen;
  marriageInformationMan?: MarriageInformationMan;
  expectedLifePartner?: ExpectedLifePartner;
  pledge?: Pledge;
  createdAt?: Date;
  updatedAt?: Date;
  numberOfConnections?:number;
  customFields?: Record<string, string>;
  howYouWannaGetMarried?: string;

}
export interface UserInfo {
  _id:string
  name: string;               // "Rifat Islam"
  userId: string;             // "user123"
  role: UserType;             // UserType.USER
  email: string;              // "rifat@example.com"
  phoneNumber: string;        // "+8801712345678"
  whatsapp?: string;
  password: string;           // "securePassword123"
  isOtpVerified: boolean; 
  numberOfConnections?:number
  gender?:string
   // true
}


export interface PaginatedUserResponse {
  docs: User[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
  pagingCounter: number;
}

export interface WebData {
  _id: string;
  home?: {
    heroVideo?: {
      bigScreen?: string;
      mobileScreen?: string;
    };
    images?: {
      left?: string;
      right?: string;
    };
  };
  about?: {
    images?: {
      left?: string;
      right?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

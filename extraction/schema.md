# SoftDent / NextDent — Backend Database Schema

Source: `NextDent_Dhaka_backend.accdb` (Access V2010, encrypted). Extracted with Jackcess. **Contains real patient PHI — keep local.**

## Table summary

| Table | Rows | Cols |
|---|---:|---:|
| tbl_API | 5 | 7 |
| tbl_Appointments | 3 | 14 |
| tbl_CommonInfo | 95 | 16 |
| tbl_Doctors | 1 | 33 |
| tbl_DoctorsPay | 0 | 12 |
| tbl_Drugs | 46043 | 6 |
| tbl_EmployeeDetails | 0 | 9 |
| tbl_ExpenseDaily | 0 | 5 |
| tbl_ExpenseMonthly | 0 | 5 |
| tbl_LabDetails | 2 | 11 |
| tbl_LabWork | 0 | 12 |
| tbl_PatientConnections | 0 | 4 |
| tbl_PatientHealthRecord | 0 | 9 |
| tbl_PatientSmsLogs | 0 | 7 |
| tbl_PatientTreatmentCases | 4 | 6 |
| tbl_PatientTreatmentDetails | 5 | 12 |
| tbl_Patients | 3230 | 22 |
| tbl_PersonAccess | 0 | 5 |
| tbl_PersonActivityLogs | 0 | 6 |
| tbl_PersonDeviceSettings | 3 | 7 |
| tbl_PersonPaid | 0 | 6 |
| tbl_PersonSecurity | 2 | 7 |
| tbl_Persons | 2 | 25 |
| tbl_PrescriptionDrug | 79 | 7 |
| tbl_PrescriptionSider | 183 | 17 |
| tbl_PrescriptionTemplateDrug | 5 | 7 |
| tbl_PrescriptionTemplates | 5 | 19 |
| tbl_Prescriptions | 48 | 24 |
| tbl_PrintDoc | 2 | 12 |
| tbl_Products | 0 | 6 |
| tbl_PurchaseOrderDetails | 0 | 10 |
| tbl_PurchaseOrders | 0 | 11 |
| tbl_RandomIncome | 0 | 5 |
| tbl_SecurityAccess | 1 | 3 |
| tbl_Sms | 15 | 9 |
| tbl_TreatmentCasePhotos | 0 | 5 |
| tbl_UserSetting | 1 | 6 |
| tbl_Vendors | 3 | 6 |

---

## Columns

### tbl_API (5 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| APIID | LONG |  | AUTONUM |
| APIName | TEXT | 255 |  |
| AccessToken | MEMO |  |  |
| AccessTokenExpire | SHORT_DATE_TIME |  |  |
| RefreshToken | TEXT | 255 |  |
| ClientID | TEXT | 255 |  |
| ClientSecret | TEXT | 255 |  |

### tbl_Appointments (3 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| AppointmentID | LONG |  | AUTONUM |
| DrID | LONG |  |  |
| PatientID | LONG |  |  |
| AllocatedUnit | TEXT | 255 |  |
| AppointmentStatusID | LONG |  |  |
| AppointmentDate | SHORT_DATE_TIME |  |  |
| AppointmentStartTime | SHORT_DATE_TIME |  |  |
| AppointmentEndTime | SHORT_DATE_TIME |  |  |
| IsAppointSmsSend | BOOLEAN |  |  |
| AppointmentSmsLog | MEMO |  |  |
| Note | MEMO |  |  |
| GCalendarID | TEXT | 255 |  |
| isAppointModified | BOOLEAN |  |  |
| GCalendarLog | MEMO |  |  |

### tbl_CommonInfo (95 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| CommonInfoID | LONG |  | AUTONUM |
| Address | TEXT | 255 |  |
| Relationship | TEXT | 255 |  |
| Occupation | TEXT | 255 |  |
| ScheduleTime | TEXT | 255 |  |
| TreatmentName | TEXT | 255 |  |
| TreatmentPrice | LONG |  |  |
| TreatmentCase | TEXT | 255 |  |
| LabColorShade | TEXT | 255 |  |
| EmployeeSalaryType | TEXT | 255 |  |
| ConnectionRelation | TEXT | 255 |  |
| UnitName | TEXT | 255 |  |
| CalendarWarning | LONG |  |  |
| InventoryProductCategory | TEXT | 255 |  |
| ExpenseName | TEXT | 255 |  |
| ExpenseAmount | LONG |  |  |

### tbl_Doctors (1 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| DoctorID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| SupevisionOwnerDrID | LONG |  |  |
| IsOwner | BOOLEAN |  |  |
| Degree | TEXT | 255 |  |
| Designation1st | TEXT | 255 |  |
| Designation2nd | TEXT | 255 |  |
| ClinicName | TEXT | 255 |  |
| Inistitute | TEXT | 255 |  |
| Session | TEXT | 255 |  |
| RegNo | FLOAT |  |  |
| ActiveStatus | TEXT | 255 |  |
| DismissalDate | SHORT_DATE_TIME |  |  |
| DismissalReason | MEMO |  |  |
| Note | MEMO |  |  |
| LabBillReductionMethods | TEXT | 255 |  |
| OwnerConsultationPercent | DOUBLE |  |  |
| OwnerOTPercent | DOUBLE |  |  |
| OwnerChamberPercent | DOUBLE |  |  |
| Case1GuestConsultantDrPercent | DOUBLE |  |  |
| Case1AppointOwnerPercent | DOUBLE |  |  |
| Case1GustOTDrPercent | DOUBLE |  |  |
| Case1ChamberPercent | DOUBLE |  |  |
| Case2GuestConsultantDrPercent | DOUBLE |  |  |
| Case2OwnerOTDrPercent | DOUBLE |  |  |
| Case2ChamberPercent | DOUBLE |  |  |
| Case3OwnerConsultantDrPercent | DOUBLE |  |  |
| Case3GuestOTDrPercent | DOUBLE |  |  |
| Case3ChamberPercent | DOUBLE |  |  |
| Case4GuestConsultantDrPercent | DOUBLE |  |  |
| Case4AppointOwnerPercent | DOUBLE |  |  |
| Case4GuestOTDrPercent | DOUBLE |  |  |
| Case4ChamberPercent | DOUBLE |  |  |

### tbl_DoctorsPay (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| DrPayID | LONG |  | AUTONUM |
| TreatmentDetailID | LONG |  |  |
| DrType | TEXT | 255 |  |
| DrID | LONG |  |  |
| DrPercent | DOUBLE |  |  |
| DrAmount | LONG |  |  |
| LastUpdated | SHORT_DATE_TIME |  |  |
| TotalAmount | LONG |  |  |
| PatientPaid | LONG |  |  |
| LabBillAmount | LONG |  |  |
| LabBillReductionMethods | TEXT | 255 |  |
| Note | MEMO |  |  |

### tbl_Drugs (46043 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| DrugID | LONG |  | AUTONUM |
| Manufacturer | TEXT | 255 |  |
| BrandName | TEXT | 255 |  |
| GenericName | TEXT | 255 |  |
| Strength | TEXT | 255 |  |
| DosagesForm | TEXT | 255 |  |

### tbl_EmployeeDetails (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| EmployeeID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| EmployeeRole | TEXT | 255 |  |
| HireDate | SHORT_DATE_TIME |  |  |
| BaseSalaryAmount | LONG |  |  |
| ActiveStatus | TEXT | 255 |  |
| DismissalDate | SHORT_DATE_TIME |  |  |
| DismissalReason | MEMO |  |  |
| Note | MEMO |  |  |

### tbl_ExpenseDaily (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| ExpenseDailyID | LONG |  | AUTONUM |
| ExpenseName | TEXT | 255 |  |
| ExpenseDate | SHORT_DATE_TIME |  |  |
| ExpenseAmount | LONG |  |  |
| Note | MEMO |  |  |

### tbl_ExpenseMonthly (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| ExpenseMonthlyID | LONG |  | AUTONUM |
| ExpenseName | TEXT | 255 |  |
| ExpenseDate | SHORT_DATE_TIME |  |  |
| ExpenseAmount | LONG |  |  |
| Note | MEMO |  |  |

### tbl_LabDetails (2 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| LabID | LONG |  | AUTONUM |
| LabName | TEXT | 255 |  |
| LabAddress | TEXT | 255 |  |
| ContactPerson | TEXT | 255 |  |
| ContactNumber | TEXT | 255 |  |
| LabEmail | TEXT | 255 |  |
| LabSpecialization | TEXT | 255 |  |
| AgreementStartDate | SHORT_DATE_TIME |  |  |
| PaymentTerms | TEXT | 255 |  |
| IsActive | BOOLEAN |  |  |
| Notes | MEMO |  |  |

### tbl_LabWork (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| LabWorkID | LONG |  | AUTONUM |
| LabID | LONG |  |  |
| TreatmentCaseID | LONG |  |  |
| WorkDate | SHORT_DATE_TIME |  |  |
| WorkStatus | TEXT | 255 |  |
| CrownType | TEXT | 255 |  |
| Quantity | LONG |  |  |
| CrownNumber | TEXT | 255 |  |
| ColorShade | TEXT | 255 |  |
| TotalAmount | LONG |  |  |
| StatusLog | MEMO |  |  |
| Notes | MEMO |  |  |

### tbl_PatientConnections (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| ConnectionID | LONG |  | AUTONUM |
| Patient1ID | LONG |  |  |
| Patient2ID | LONG |  |  |
| RelationshipType | TEXT | 255 |  |

### tbl_PatientHealthRecord (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PatientHealthRecordID | LONG |  | AUTONUM |
| PatientID | LONG |  |  |
| RecordDate | SHORT_DATE_TIME |  |  |
| BloodPressure | TEXT | 255 |  |
| BloodGlucose | TEXT | 255 |  |
| HeartRate | TEXT | 255 |  |
| BloodOxygen | TEXT | 255 |  |
| BodyWeight | LONG |  |  |
| Note | MEMO |  |  |

### tbl_PatientSmsLogs (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PatientSmsLogID | LONG |  | AUTONUM |
| PatientID | LONG |  |  |
| SenderID | LONG |  |  |
| SmsType | TEXT | 255 |  |
| SmsPhone | TEXT | 11 |  |
| SmsDate | SHORT_DATE_TIME |  |  |
| SmsMessage | MEMO |  |  |

### tbl_PatientTreatmentCases (4 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| TreatmentCaseID | LONG |  | AUTONUM |
| PatientID | LONG |  |  |
| CaseName | TEXT | 255 |  |
| CaseDescription | MEMO |  |  |
| CaseStatus | TEXT | 255 |  |
| Notes | MEMO |  |  |

### tbl_PatientTreatmentDetails (5 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| TreatmentDetailID | LONG |  | AUTONUM |
| TreatmentCaseID | LONG |  |  |
| OTDrID | LONG |  |  |
| TreatmentDate | SHORT_DATE_TIME |  |  |
| TreatmentName | TEXT | 255 |  |
| TreatmentDescription | TEXT | 255 |  |
| TotalAmount | LONG |  |  |
| DiscountPercent | DOUBLE |  |  |
| AfterDiscountAmount | LONG |  |  |
| AmountPaid | LONG |  |  |
| SelectedRow | BOOLEAN |  |  |
| Note | MEMO |  |  |

### tbl_Patients (3230 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PatientID | LONG |  |  |
| PatientFullName | TEXT | 255 |  |
| PatientNickName | TEXT | 255 |  |
| PatientConsultantDrID | LONG |  |  |
| PatientEmailAddress | TEXT | 255 |  |
| PatientPrimaryPhone | TEXT | 11 |  |
| PatientForeignPhone | TEXT | 255 |  |
| PatientSince | SHORT_DATE_TIME |  |  |
| PatientDOB | SHORT_DATE_TIME |  |  |
| PatientAddress | TEXT | 255 |  |
| PatientGender | TEXT | 255 |  |
| PatientMaritalStatus | TEXT | 255 |  |
| PatientOccupation | TEXT | 255 |  |
| PatientEmergencyRelation | TEXT | 255 |  |
| PatientEmergencyRelativeName | TEXT | 255 |  |
| PatientEmergencyRelativePhone | TEXT | 11 |  |
| PatientPhotoPath | TEXT | 255 |  |
| PatientPhotoURL | TEXT | 255 |  |
| PatientLifeTimeDiscount | DOUBLE |  |  |
| PatientMedicalHistory | MEMO |  |  |
| PatientDrugHistory | MEMO |  |  |
| PatientNote | MEMO |  |  |

### tbl_PersonAccess (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PersonAccessID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| AccessGivenPersonID | LONG |  |  |
| SecurityAccessID | LONG |  |  |
| AccessGivenDate | SHORT_DATE_TIME |  |  |

### tbl_PersonActivityLogs (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PersonActivityLogID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| ActivityTime | SHORT_DATE_TIME |  |  |
| ActivityDescription | TEXT | 255 |  |
| PersonMACAddress | TEXT | 255 |  |
| PersonDeviceName | TEXT | 255 |  |

### tbl_PersonDeviceSettings (3 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PersonDeviceSettingID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| ThemeID | LONG |  |  |
| CreateDate | SHORT_DATE_TIME |  |  |
| DeviceGUID | MEMO |  |  |
| DeviceName | TEXT | 255 |  |
| FormZoom | LONG |  |  |

### tbl_PersonPaid (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PersonPaidID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| PaymentDate | SHORT_DATE_TIME |  |  |
| PaymentType | TEXT | 255 |  |
| PaymentAmount | LONG |  |  |
| Note | MEMO |  |  |

### tbl_PersonSecurity (2 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PersonSecurityID | LONG |  | AUTONUM |
| PersonID | LONG |  |  |
| ActiveStatus | TEXT | 255 |  |
| PersonRole | TEXT | 255 |  |
| PersonUserName | TEXT | 255 |  |
| PersonPasswordSalt | TEXT | 255 |  |
| PersonPasswordHash | TEXT | 255 |  |

### tbl_Persons (2 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PersonID | LONG |  | AUTONUM |
| PersonFullName | TEXT | 255 |  |
| PersonNickName | TEXT | 255 |  |
| PersonPrimaryPhone | TEXT | 11 |  |
| PersonSecondaryPhone | TEXT | 11 |  |
| PersonAddress | TEXT | 255 |  |
| PersonEmailAddress | TEXT | 255 |  |
| PersonDOB | SHORT_DATE_TIME |  |  |
| PersonGender | TEXT | 255 |  |
| PersonMaritalStatus | TEXT | 255 |  |
| PersonNID | TEXT | 255 |  |
| ConnectedSince | SHORT_DATE_TIME |  |  |
| PersonPhotoPath | TEXT | 255 |  |
| PersonPhotoURL | TEXT | 255 |  |
| PersonEmergencyRelation | TEXT | 255 |  |
| PersonEmergencyRelativeName | TEXT | 255 |  |
| PersonEmergencyRelativePhone | TEXT | 11 |  |
| Note | MEMO |  |  |
| DateOfBirth | SHORT_DATE_TIME |  |  |
| EmergencyRelation | TEXT | 255 |  |
| EmergencyRelativeName | TEXT | 255 |  |
| EmergencyRelativeNumber | TEXT | 255 |  |
| ActiveStatus | BOOLEAN |  |  |
| DentistStaticPhotoPath | TEXT | 255 |  |
| DentistDynamicPhotoPath | TEXT | 255 |  |

### tbl_PrescriptionDrug (79 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| RxDrugID | LONG |  | AUTONUM |
| PrescriptionID | LONG |  |  |
| SortOrder | LONG |  |  |
| Drug | TEXT | 255 |  |
| Dose | MEMO |  |  |
| Meal | TEXT | 255 |  |
| Duration | TEXT | 255 |  |

### tbl_PrescriptionSider (183 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PrescriptionSiderID | LONG |  | AUTONUM |
| Complaints | TEXT | 255 |  |
| MedicalHistory | TEXT | 255 |  |
| PreviousDentalHistory | TEXT | 255 |  |
| Diagnosis | TEXT | 255 |  |
| InvestigationAdvised | TEXT | 255 |  |
| InvestigationInterpretation | TEXT | 255 |  |
| Treatment | TEXT | 255 |  |
| AdviseHeader | TEXT | 255 |  |
| Advise | MEMO |  |  |
| DrugDoseSortOrder | LONG |  |  |
| DrugDose | MEMO |  |  |
| DrugDurationSortOrder | LONG |  |  |
| DrugDuration | TEXT | 255 |  |
| DrugMealSortOrder | LONG |  |  |
| DrugMeal | TEXT | 255 |  |
| FollowUpReason | TEXT | 255 |  |

### tbl_PrescriptionTemplateDrug (5 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| TemplateDrugID | LONG |  | AUTONUM |
| PrescriptionTemplateID | LONG |  |  |
| SortOrder | LONG |  |  |
| Drug | TEXT | 255 |  |
| Dose | MEMO |  |  |
| Meal | TEXT | 255 |  |
| Duration | TEXT | 255 |  |

### tbl_PrescriptionTemplates (5 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PrescriptionTemplateID | LONG |  | AUTONUM |
| TemplateName | TEXT | 255 |  |
| Complaints | MEMO |  |  |
| FindingsOnExamination | MEMO |  |  |
| ProvisionalDiagnosis | MEMO |  |  |
| DifferentialDiagnosis | MEMO |  |  |
| InvestigationAdvised | MEMO |  |  |
| ConfirmatoryDiagnosis | MEMO |  |  |
| TreatmentPlan | MEMO |  |  |
| ProcedurePerformed | MEMO |  |  |
| Advise | MEMO |  |  |
| FollowUPDay | LONG |  |  |
| FollowUpReason | TEXT | 255 |  |
| DeleteAt | SHORT_DATE_TIME |  |  |
| DeleteBy | TEXT | 255 |  |
| CreatedBy | TEXT | 255 |  |
| CreatedAt | SHORT_DATE_TIME |  |  |
| EditedBy | TEXT | 255 |  |
| EditedAt | SHORT_DATE_TIME |  |  |

### tbl_Prescriptions (48 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PrescriptionID | LONG |  | AUTONUM |
| PatientID | LONG |  |  |
| RxDentistID | LONG |  |  |
| RxDate | SHORT_DATE_TIME |  |  |
| Complaints | MEMO |  |  |
| MedicalHistory | MEMO |  |  |
| DrugHistory | MEMO |  |  |
| PreviousDentalHistory | MEMO |  |  |
| FindingsOnExamination | MEMO |  |  |
| ProvisionalDiagnosis | MEMO |  |  |
| DifferentialDiagnosis | MEMO |  |  |
| InvestigationAdvised | MEMO |  |  |
| InvestigationInterpretation | MEMO |  |  |
| ConfirmatoryDiagnosis | MEMO |  |  |
| TreatmentPlan | MEMO |  |  |
| ProcedurePerformed | MEMO |  |  |
| Advise | MEMO |  |  |
| FollowUpDate | SHORT_DATE_TIME |  |  |
| FollowUpReason | TEXT | 255 |  |
| RandomName | TEXT | 255 |  |
| RandomAge | TEXT | 255 |  |
| RandomSex | TEXT | 255 |  |
| DeleteAt | SHORT_DATE_TIME |  |  |
| DeleteBy | TEXT | 255 |  |

### tbl_PrintDoc (2 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PrintDocID | LONG |  | AUTONUM |
| DocName | TEXT | 255 |  |
| DocHeading1 | TEXT | 255 |  |
| DocHeading2 | TEXT | 255 |  |
| DocHeading3 | TEXT | 255 |  |
| DocHeading4 | TEXT | 255 |  |
| DocHeading5 | TEXT | 255 |  |
| DocHeading6 | TEXT | 255 |  |
| DocHeading7 | TEXT | 255 |  |
| DocHeading8 | TEXT | 255 |  |
| DocHeading9 | TEXT | 255 |  |
| DocFooter | TEXT | 255 |  |

### tbl_Products (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| ProductID | LONG |  | AUTONUM |
| ProductCategory | TEXT | 255 |  |
| ProductName | TEXT | 255 |  |
| MinReqQty | LONG |  |  |
| ProductDescription | TEXT | 255 |  |
| Note | MEMO |  |  |

### tbl_PurchaseOrderDetails (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PurchaseOrderDetailID | LONG |  | AUTONUM |
| PurchaseOrderID | LONG |  |  |
| VendorID | LONG |  |  |
| ProductID | LONG |  |  |
| Quantity | LONG |  |  |
| UnitCost | LONG |  |  |
| ProductSerial | TEXT | 255 |  |
| ExpiryDate | SHORT_DATE_TIME |  |  |
| ProductStatus | TEXT | 255 |  |
| StockOutDate | SHORT_DATE_TIME |  |  |

### tbl_PurchaseOrders (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| PurchaseOrderID | LONG |  | AUTONUM |
| VendorID | LONG |  |  |
| SubmittedByID | LONG |  |  |
| SubmittedDate | SHORT_DATE_TIME |  |  |
| ApprovedByID | LONG |  |  |
| ApprovedDate | SHORT_DATE_TIME |  |  |
| Status | TEXT | 255 |  |
| ReceivedDate | SHORT_DATE_TIME |  |  |
| PaymentDate | SHORT_DATE_TIME |  |  |
| PaymentAmount | LONG |  |  |
| Note | MEMO |  |  |

### tbl_RandomIncome (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| RandomIncomeID | LONG |  | AUTONUM |
| IncomeDate | SHORT_DATE_TIME |  |  |
| IncomeAmount | LONG |  |  |
| IncomeDetails | TEXT | 255 |  |
| Note | MEMO |  |  |

### tbl_SecurityAccess (1 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| SecurityAccessID | LONG |  | AUTONUM |
| Access | TEXT | 255 |  |
| Note | MEMO |  |  |

### tbl_Sms (15 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| SmsID | LONG |  | AUTONUM |
| SmsName | TEXT | 255 |  |
| SmsHeading | TEXT | 255 |  |
| SmsBody1 | TEXT | 255 |  |
| SmsBody2 | TEXT | 255 |  |
| SmsBody3 | TEXT | 255 |  |
| SmsBody4 | TEXT | 255 |  |
| SmsBody5 | TEXT | 255 |  |
| SmsBody6 | TEXT | 255 |  |

### tbl_TreatmentCasePhotos (0 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| TreatmentCasePhotoID | LONG |  | AUTONUM |
| TreatmentCaseID | LONG |  |  |
| PhotoPath | TEXT | 255 |  |
| PhotoDate | SHORT_DATE_TIME |  |  |
| Note | MEMO |  |  |

### tbl_UserSetting (1 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| UserSettingID | LONG |  | AUTONUM |
| DefaultRxType | TEXT | 255 |  |
| BodyRxReportName | TEXT | 255 |  |
| FullRxReportName | TEXT | 255 |  |
| AutoAddAppointmentWhenAddingTreatmentDetails | BOOLEAN |  |  |
| AutoCompleteAppointmentWhenAddingTreatmentDetails | BOOLEAN |  |  |

### tbl_Vendors (3 rows)

| Column | Type | Len | Flags |
|---|---|---:|---|
| VendorID | LONG |  | AUTONUM |
| VendorName | TEXT | 255 |  |
| BusinessPhone | TEXT | 255 |  |
| Address | TEXT | 255 |  |
| Website | TEXT | 255 |  |
| Note | MEMO |  |  |

---

## Relationships (foreign keys)

- **tbl_Persons**(PersonID) → **tbl_EmployeeDetails**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PersonSecurity**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PersonAccess**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PersonDeviceSettings**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_Doctors**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PersonAccess**(AccessGivenPersonID)  _[enforced RI]_
- **tbl_PrescriptionTemplates**(PrescriptionTemplateID) → **tbl_PrescriptionTemplateDrug**(PrescriptionTemplateID)  _[enforced RI]_
- **tbl_Prescriptions**(PrescriptionID) → **tbl_PrescriptionDrug**(PrescriptionID)  _[enforced RI]_
- **tbl_LabDetails**(LabID) → **tbl_LabWork**(LabID)  _[enforced RI]_
- **tbl_SecurityAccess**(SecurityAccessID) → **tbl_PersonAccess**(SecurityAccessID)  _[enforced RI]_
- **tbl_Doctors**(DoctorID) → **tbl_Appointments**(DrID)  _[enforced RI]_
- **tbl_Doctors**(DoctorID) → **tbl_Doctors**(SupevisionOwnerDrID)  _[enforced RI]_
- **tbl_Doctors**(DoctorID) → **tbl_DoctorsPay**(DrID)  _[enforced RI]_
- **tbl_Doctors**(DoctorID) → **tbl_PatientTreatmentDetails**(OTDrID)  _[enforced RI]_
- **tbl_Doctors**(DoctorID) → **tbl_Prescriptions**(RxDentistID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_Appointments**(PatientID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_PatientConnections**(Patient1ID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_PatientConnections**(Patient2ID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_PatientHealthRecord**(PatientID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_PatientSmsLogs**(PatientID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_PatientTreatmentCases**(PatientID)  _[enforced RI]_
- **tbl_Patients**(PatientID) → **tbl_Prescriptions**(PatientID)  _[enforced RI]_
- **tbl_PatientTreatmentCases**(TreatmentCaseID) → **tbl_LabWork**(TreatmentCaseID)  _[enforced RI]_
- **tbl_PatientTreatmentCases**(TreatmentCaseID) → **tbl_PatientTreatmentDetails**(TreatmentCaseID)  _[enforced RI]_
- **tbl_PatientTreatmentCases**(TreatmentCaseID) → **tbl_TreatmentCasePhotos**(TreatmentCaseID)  _[enforced RI]_
- **tbl_PatientTreatmentDetails**(TreatmentDetailID) → **tbl_DoctorsPay**(TreatmentDetailID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PatientSmsLogs**(SenderID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PersonActivityLogs**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PersonPaid**(PersonID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PurchaseOrders**(SubmittedByID)  _[enforced RI]_
- **tbl_Persons**(PersonID) → **tbl_PurchaseOrders**(ApprovedByID)  _[enforced RI]_
- **tbl_Products**(ProductID) → **tbl_PurchaseOrderDetails**(ProductID)  _[enforced RI]_
- **tbl_PurchaseOrders**(PurchaseOrderID) → **tbl_PurchaseOrderDetails**(PurchaseOrderID)  _[enforced RI]_
- **tbl_Sms**(SmsID) → **tbl_Appointments**(AppointmentStatusID)  _[enforced RI]_
- **tbl_Vendors**(VendorID) → **tbl_PurchaseOrderDetails**(VendorID)  _[enforced RI]_

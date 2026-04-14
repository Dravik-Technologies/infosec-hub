import { Schema, model, Document, Types } from 'mongoose'

export interface IInfoSystem extends Document<string> {
  userId: Types.ObjectId
  name: string
  abbreviation: string
  systemType: string
  organization: string
  description: string
  classificationMarking?: string
  ciaAnswers: {
    confidentiality: string
    integrity: string
    availability: string
    confidentialityRationale: string
    integrityRationale: string
    availabilityRationale: string
  }
  recommendedBaseline: string
  selectedBaseline: string
  atoStatus: string
  atoExpirationDate: string | null
  systemOwner: string
  isso: string
  issm: string
}

const infoSystemSchema = new Schema<IInfoSystem>(
  {
    _id: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    abbreviation: String,
    systemType: String,
    organization: String,
    description: String,
    classificationMarking: String,
    ciaAnswers: {
      confidentiality: String,
      integrity: String,
      availability: String,
      confidentialityRationale: String,
      integrityRationale: String,
      availabilityRationale: String,
    },
    recommendedBaseline: String,
    selectedBaseline: String,
    atoStatus: String,
    atoExpirationDate: String,
    systemOwner: String,
    isso: String,
    issm: String,
  },
  { timestamps: true }
)

infoSystemSchema.set('toJSON', {
  transform: (_: any, ret: any) => {
    ret.id = ret._id
    ret.createdAt = ret.createdAt?.toISOString?.() ?? ret.createdAt
    ret.updatedAt = ret.updatedAt?.toISOString?.() ?? ret.updatedAt
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export const InfoSystem = model<IInfoSystem>('InfoSystem', infoSystemSchema)

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

export interface AuthResponse {
  user: User
  token: string
}

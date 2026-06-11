import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const signup = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user, token }) => {
      setAuth(user, token)
      toast.success('ACCOUNT CREATED — WELCOME, OPERATOR')
      navigate('/dashboard')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'REGISTRATION FAILED'),
  })

  return (
    <div className="min-h-screen bg-space flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-mono font-bold text-cyan-neon tracking-widest text-lg">CRATER</p>
          <p className="hud-label text-slate-600 mt-1">REQUEST SYSTEM ACCESS</p>
        </div>

        <form onSubmit={handleSubmit(d => signup.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="hud-label mb-1.5 block">FIRST NAME</label>
              <input {...register('firstName')} className="input-hud" />
              {errors.firstName && <p className="font-mono text-red-alert text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="hud-label mb-1.5 block">LAST NAME</label>
              <input {...register('lastName')} className="input-hud" />
              {errors.lastName && <p className="font-mono text-red-alert text-xs mt-1">{errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <label className="hud-label mb-1.5 block">EMAIL</label>
            <input {...register('email')} type="email" className="input-hud" placeholder="operator@agency.gov" />
            {errors.email && <p className="font-mono text-red-alert text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="hud-label mb-1.5 block">PASSWORD</label>
            <input {...register('password')} type="password" className="input-hud" placeholder="Min 8 characters" />
            {errors.password && <p className="font-mono text-red-alert text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={signup.isPending} className="btn-primary w-full mt-2">
            {signup.isPending ? 'REGISTERING...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="text-center mt-6 font-mono text-xs text-slate-600">
          HAVE ACCESS?{' '}
          <Link to="/login" className="text-cyan-neon/70 hover:text-cyan-neon transition-colors">
            AUTHENTICATE
          </Link>
        </p>
      </div>
    </div>
  )
}

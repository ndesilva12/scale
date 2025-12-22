import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#84cc16',
            colorBackground: '#1f2937',
            colorText: '#ffffff',
            colorTextSecondary: '#9ca3af',
            colorInputBackground: '#374151',
            colorInputText: '#ffffff',
            colorDanger: '#ef4444',
            borderRadius: '1rem',
            fontSize: '0.875rem',
          },
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-gray-800/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-6',
            headerTitle: 'text-white text-xl font-bold',
            headerSubtitle: 'text-gray-400 text-sm',
            // Social buttons
            socialButtonsBlockButton: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all rounded-2xl py-2.5',
            socialButtonsBlockButtonText: 'text-white font-medium text-sm',
            socialButtonsBlockButtonArrow: 'text-white',
            socialButtonsProviderIcon: 'w-5 h-5',
            // Divider
            dividerLine: 'bg-white/10',
            dividerText: 'text-gray-500 text-xs bg-gray-800',
            // Form fields - subtle borders
            formFieldLabel: 'text-gray-300 text-xs font-medium',
            formFieldInput: 'bg-white/5 border border-white/10 text-white text-sm py-2.5 px-3 rounded-2xl focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/30 placeholder:text-gray-500',
            formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',
            formFieldHintText: 'text-gray-500 text-xs',
            // Primary button - glass style to match app
            formButtonPrimary: 'bg-white/10 border border-white/30 text-white hover:bg-white/15 hover:border-white/50 transition-all rounded-2xl py-2.5 font-medium text-sm',
            // Footer links
            footerActionLink: 'text-lime-400 hover:text-lime-300 font-medium text-sm',
            footerActionText: 'text-gray-400 text-sm',
            // Identity preview
            identityPreviewText: 'text-white text-sm',
            identityPreviewEditButton: 'text-lime-400 hover:text-lime-300',
            identityPreviewEditButtonIcon: 'text-lime-400',
            // Alert/development banner
            alert: 'bg-white/5 border border-white/10 text-gray-300 rounded-2xl text-xs',
            alertText: 'text-gray-400 text-xs',
            alertTextDanger: 'text-red-400 text-xs',
            // Badge
            badge: 'bg-white/5 border border-white/10 text-gray-400 rounded-xl text-xs',
            // OTP
            formResendCodeLink: 'text-lime-400 hover:text-lime-300 text-sm',
            otpCodeFieldInput: 'bg-white/5 border border-white/10 text-white rounded-xl',
            alternativeMethodsBlockButton: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl text-sm',
            // Layout
            main: 'gap-4',
            form: 'gap-3',
            // Remove internal backgrounds
            formFieldRow: 'gap-2',
            formField: 'gap-1',
          },
        }}
      />
    </div>
  );
}

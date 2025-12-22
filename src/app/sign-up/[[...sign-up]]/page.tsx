import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#84cc16',
            colorBackground: '#111827',
            colorText: '#ffffff',
            colorTextSecondary: '#d1d5db',
            colorInputBackground: '#1f2937',
            colorInputText: '#ffffff',
            colorDanger: '#9ca3af',
            borderRadius: '0.75rem',
            fontSize: '1rem',
          },
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-gray-800/90 backdrop-blur-xl border-2 border-white/20 shadow-2xl rounded-2xl p-8',
            headerTitle: 'text-white text-2xl font-bold',
            headerSubtitle: 'text-gray-300 text-base',
            // Social buttons - dark with visible border
            socialButtonsBlockButton: 'bg-gray-700 border-2 border-gray-500 text-white hover:bg-gray-600 hover:border-gray-400 transition-all rounded-xl py-3',
            socialButtonsBlockButtonText: 'text-white font-medium text-base',
            socialButtonsBlockButtonArrow: 'text-white',
            socialButtonsProviderIcon: 'w-5 h-5',
            // Divider
            dividerLine: 'bg-gray-600',
            dividerText: 'text-gray-400 text-sm bg-gray-800',
            // Form fields
            formFieldLabel: 'text-gray-200 text-sm font-medium',
            formFieldInput: 'bg-gray-700 border-2 border-gray-500 text-white text-base py-3 px-4 rounded-xl focus:border-lime-500 focus:ring-2 focus:ring-lime-500/30 placeholder:text-gray-400',
            formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',
            // Primary button - lime accent
            formButtonPrimary: 'bg-lime-600 border-0 text-white hover:bg-lime-500 transition-all rounded-xl py-3 font-semibold text-base shadow-lg',
            // Footer links
            footerActionLink: 'text-lime-400 hover:text-lime-300 font-medium',
            footerActionText: 'text-gray-400',
            // Identity preview
            identityPreviewText: 'text-white text-base',
            identityPreviewEditButton: 'text-lime-400 hover:text-lime-300',
            identityPreviewEditButtonIcon: 'text-lime-400',
            // Alert/development banner - subtle grey
            alert: 'bg-gray-700/50 border border-gray-600 text-gray-300 rounded-xl',
            alertText: 'text-gray-300 text-sm',
            alertTextDanger: 'text-gray-400',
            // Badge (development mode)
            badge: 'bg-gray-600 border border-gray-500 text-gray-300 rounded-lg',
            // Other elements
            formResendCodeLink: 'text-lime-400 hover:text-lime-300',
            otpCodeFieldInput: 'bg-gray-700 border-2 border-gray-500 text-white rounded-xl',
            alternativeMethodsBlockButton: 'bg-gray-700 border-2 border-gray-500 text-white hover:bg-gray-600 rounded-xl',
            // Internal card styling
            main: 'gap-6',
            form: 'gap-4',
          },
        }}
      />
    </div>
  );
}

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
            borderRadius: '0.75rem',
          },
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-gray-800 border border-gray-700 shadow-2xl',
            headerTitle: 'text-white',
            headerSubtitle: 'text-gray-400',
            socialButtonsBlockButton: 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600',
            socialButtonsBlockButtonText: 'text-white',
            dividerLine: 'bg-gray-600',
            dividerText: 'text-gray-400',
            formFieldLabel: 'text-gray-300',
            formFieldInput: 'bg-gray-700 border-gray-600 text-white',
            formButtonPrimary: 'bg-lime-600 hover:bg-lime-500',
            footerActionLink: 'text-lime-400 hover:text-lime-300',
            identityPreviewText: 'text-white',
            identityPreviewEditButton: 'text-lime-400',
          },
        }}
      />
    </div>
  );
}

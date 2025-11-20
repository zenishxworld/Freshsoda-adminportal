// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-light via-background to-accent-light">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-business-blue to-business-blue-dark rounded-3xl mb-6 shadow-strong">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v1a1 1 0 001 1h1l1.68 5.39a3 3 0 002.84 2.11h5.95a3 3 0 002.84-2.11L19 8H7a1 1 0 01-1-1V6a1 1 0 00-1-1H3z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-foreground">BHAVYA ENTERPRICE</h1>
        <p className="text-xl text-muted-foreground">Professional sales management for drivers and salesmen</p>
        <div className="space-y-4">
          <a 
            href="/auth"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-business-blue to-business-blue-dark text-white font-semibold px-8 py-4 rounded-xl hover:shadow-medium transition-all duration-200 active:scale-[0.98]"
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
};

export default Index;

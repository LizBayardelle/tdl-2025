Rails.application.routes.draw do
  devise_for :users

  # User profile image upload
  patch "users/profile_image", to: "users#update_profile_image", as: :update_profile_image
  get   "users/me", to: "users#me", as: :user_me

  root "home#index"
  get "samplepage", to: "samplepage#index"
  get "dashboard", to: "home#dashboard"
  get "sharing", to: "home#sharing", as: :sharing
  get "uploads", to: "home#uploads", as: :uploads
  get "search", to: "search#index"

  # Subscriptions
  get  "subscribe",          to: "subscriptions#new",    as: :subscribe
  post "subscriptions",      to: "subscriptions#create"
  get  "subscription",       to: "subscriptions#show",   as: :subscription
  post "subscription/portal", to: "subscriptions#portal", as: :subscription_portal
  post "subscription/cancel", to: "subscriptions#cancel", as: :subscription_cancel
  post "subscription/resume", to: "subscriptions#resume", as: :subscription_resume

  # Stripe webhooks
  post "webhooks/stripe", to: "webhooks#stripe"

  # Legal & static
  get "legal", to: "legal#index", as: :legal
  get "legal/:slug", to: "legal#show", as: :legal_page

  # Admin
  namespace :admin do
    get "/", to: "dashboard#index", as: :dashboard
    get "docs", to: "docs#index", as: :docs
    get "docs/:slug", to: "docs#show", as: :doc
    resources :users, only: [:index, :update]

    resources :concept_generations, only: [:index, :new, :create, :show, :update] do
      member do
        post :approve
        post :reject
        post :retry_stage
      end
    end

    resources :statistical_tests, path: 'stats' do
      collection do
        post :auto_fill
      end
    end
  end

  resources :upload_batches, only: [:index, :show, :create, :destroy] do
    collection do
      get :active
    end
    member do
      post :start_processing
      post :add_files
    end
  end

  resources :upload_batch_items, only: [:show, :update] do
    member do
      post :approve
      post :retry
      post :skip
    end
  end

  resources :concepts, only: [:index, :show, :create, :update, :destroy] do
    collection do
      get :search
      post :find_or_create_from_keywords
      post :suggest_from_metadata
    end
    member do
      post :suggest_relationships
      post :generate_definition
      post :reject_definition
    end
    resources :links, only: [:index, :create, :destroy], controller: 'concept_links'
  end
  resources :connections, only: [:index, :show, :create, :update, :destroy]

  # Public statistical test catalog
  resources :statistical_tests, only: [:index, :show], path: 'stats', param: :slug

  resources :sources, only: [:index, :show, :create, :update, :destroy] do
    collection do
      post :extract_metadata
      post :extract_from_pdf
      post :citations
      post :tag_research_types
      post :tag_statistical_tests
      post :suggest_authors
      post :flesh_out_citation
    end
    member do
      get :study
      get :notes
      get :sections
      post :passage_insights
      post :ask
      post :enrich_from_citation
    end
  end
  resources :people, only: [:index, :show, :create, :update, :destroy] do
    collection do
      get :search
      get :search_orcid
    end
    member do
      post :enrich
    end
  end
  resources :notes
  resources :tags, only: [:index, :show, :create, :update, :destroy]
  resources :highlight_colors, only: [:index, :create, :update, :destroy] do
    collection do
      post :reorder
    end
  end
  resources :highlights, only: [:index, :create, :update, :destroy]

  resources :collections do
    member do
      post :add_item
      delete :remove_item
    end
  end

  resources :tabletops do
    resources :items, only: [:index, :create, :update, :destroy], controller: 'tabletop_items'
    member do
      patch :viewport
      post  :import_notes
    end
  end

  resources :shares, only: [:index, :create, :update, :destroy] do
    collection do
      get :received
    end
  end
  get 'shares/accept/:token', to: 'shares#accept', as: :accept_share

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
end

Rails.application.routes.draw do
  devise_for :users

  # User profile image upload
  patch "users/profile_image", to: "users#update_profile_image", as: :update_profile_image

  root "home#index"
  get "dashboard", to: "home#dashboard"
  get "sharing", to: "home#sharing", as: :sharing
  get "uploads", to: "home#uploads", as: :uploads
  get "search", to: "search#index"

  # Packs & purchasing
  resources :packs, only: [:index, :show] do
    collection do
      get :owned
    end
  end
  post "checkout/:pack_id", to: "checkouts#create", as: :checkout

  # Stripe webhooks
  post "webhooks/stripe", to: "webhooks#stripe"

  # Admin
  namespace :admin do
    get "/", to: "dashboard#index", as: :dashboard
    resources :packs do
      member do
        post :sync_stripe
      end
      resources :concept_definitions, only: [:create, :update, :destroy] do
        collection do
          get :search_concepts
          post :import_from_concept
        end
        resources :links, only: [:create, :destroy], controller: 'concept_definition_links'
      end
    end
    resources :users, only: [:index, :update]
  end

  resources :batch_uploads, only: [:index, :show, :create, :destroy] do
    collection do
      get :active
    end
    member do
      post :start_processing
    end
  end

  resources :batch_upload_items, only: [:show, :update] do
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
    resources :links, only: [:index, :create, :destroy], controller: 'concept_links'
  end
  resources :connections, only: [:index, :show, :create, :update, :destroy]
  resources :sources, only: [:index, :show, :create, :update, :destroy] do
    collection do
      post :extract_metadata
      post :extract_from_pdf
    end
    member do
      get :study
      get :notes
    end
  end
  resources :people, only: [:index, :show, :create, :update, :destroy] do
    collection do
      get :search
      get :search_orcid
    end
  end
  resources :notes
  resources :tags, only: [:index, :show, :create, :update, :destroy]
  resources :highlight_colors, only: [:index, :create, :update, :destroy] do
    collection do
      post :reorder
    end
  end
  resources :highlights, only: [:index, :create, :destroy]

  resources :collections do
    member do
      post :add_item
      delete :remove_item
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

Rails.application.routes.draw do
  devise_for :users

  # User profile image upload
  patch "users/profile_image", to: "users#update_profile_image", as: :update_profile_image

  root "home#index"
  get "dashboard", to: "home#dashboard"
  get "sharing", to: "home#sharing", as: :sharing
  get "search", to: "search#index"

  resources :concepts, only: [:index, :show, :create, :update, :destroy] do
    collection do
      post :find_or_create_from_keywords
      post :suggest_from_metadata
    end
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
